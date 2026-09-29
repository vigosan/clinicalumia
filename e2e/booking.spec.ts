import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  addDays,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { latestCodeFor, latestEmailFor } from "./mail";
import { userIdsWithEmails } from "./users";

const WEB = "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:54324/api/v1";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const createdSpecialtyIds: string[] = [];
const createdServiceIds: string[] = [];
const createdUserIds: string[] = [];
const usedEmails: string[] = [];

function unique() {
  return `${Date.now()}-${randomInt(1e9)}`;
}

async function createSpecialty() {
  const suffix = unique();
  const name = `Reserva web e2e ${suffix}`;
  const { data, error } = await admin
    .from("specialties")
    .insert({ name, slug: `reserva-web-e2e-${suffix}` })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdSpecialtyIds.push(data!.id);
  return { id: data!.id as string, name };
}

async function createService(
  specialtyId: string,
  payment: { booking_payment: "fixed"; booking_payment_value: number } | null,
) {
  const name = `Sesión e2e ${unique()}`;
  const { data, error } = await admin
    .from("services")
    .insert({
      specialty_id: specialtyId,
      name,
      duration_minutes: 45,
      price_cents: 4500,
      bookable_online: true,
      ...payment,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdServiceIds.push(data!.id);
  return { id: data!.id as string, name };
}

async function createProfessional(
  specialtyId: string,
  fullName: string,
  withSchedule: boolean,
) {
  const email = `reserva-profesional-${unique()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  createdUserIds.push(id);
  const { error: profileError } = await admin.from("profiles").insert({
    id,
    email,
    full_name: fullName,
    role: "employee",
    specialty_id: specialtyId,
    is_active: true,
  });
  expect(profileError).toBeNull();
  if (withSchedule) {
    const { error: scheduleError } = await admin
      .from("employee_schedules")
      .insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          profile_id: id,
          weekday,
          starts_at: "09:00",
          ends_at: "13:00",
        })),
      );
    expect(scheduleError).toBeNull();
  }
  return id;
}

async function clinicWithTwoProfessionals() {
  const specialty = await createSpecialty();
  const service = await createService(specialty.id, null);
  const suffix = unique();
  const withHours = `Ana Horario ${suffix}`;
  const withoutHours = `Bruno Sinhorario ${suffix}`;
  const withHoursId = await createProfessional(specialty.id, withHours, true);
  await createProfessional(specialty.id, withoutHours, false);
  return { specialty, service, withHours, withHoursId, withoutHours };
}

async function openService(
  page: Page,
  specialtyName: string,
  serviceName: string,
) {
  await page.goto(`${WEB}/reservar`);
  await page
    .getByTestId("booking-specialty")
    .filter({ hasText: specialtyName })
    .click();
  await page
    .getByTestId("booking-service")
    .filter({ hasText: serviceName })
    .click();
}

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${unique()}@test.local`;
  usedEmails.push(email);
  return email;
}

function randomIp() {
  return `198.18.${randomInt(256)}.${randomInt(256)}`;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function removePatients(emails: string[]) {
  if (emails.length === 0) return;
  const { data: adults, error } = await admin
    .from("people")
    .select("id")
    .in("email", emails);
  if (error) throw error;
  const adultIds = adults.map((person) => person.id);
  const { data: wards, error: wardsError } = await admin
    .from("guardianships")
    .select("minor_id")
    .in("guardian_id", adultIds);
  if (wardsError) throw wardsError;
  for (const ids of [wards.map((ward) => ward.minor_id), adultIds]) {
    if (ids.length === 0) continue;
    const { error: appointmentsError } = await admin
      .from("appointments")
      .delete()
      .in("patient_id", ids);
    if (appointmentsError) throw appointmentsError;
    const { error: peopleError } = await admin
      .from("people")
      .delete()
      .in("id", ids);
    if (peopleError) throw peopleError;
  }
  for (const id of await userIdsWithEmails(admin, emails)) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;
  }
  const { error: requestsError } = await admin
    .from("access_requests")
    .delete()
    .in("email", emails);
  if (requestsError) throw requestsError;
  for (const email of emails) {
    await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
      { method: "DELETE" },
    );
  }
}

test.afterEach(async () => {
  await removePatients(usedEmails.splice(0));
  if (createdUserIds.length > 0) {
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("professional_id", createdUserIds);
    if (error) throw error;
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  const serviceIds = createdServiceIds.splice(0);
  if (serviceIds.length > 0) {
    const { error } = await admin
      .from("services")
      .delete()
      .in("id", serviceIds);
    if (error) throw error;
  }
  const specialtyIds = createdSpecialtyIds.splice(0);
  if (specialtyIds.length > 0) {
    const { error } = await admin
      .from("specialties")
      .delete()
      .in("id", specialtyIds);
    if (error) throw error;
  }
});

test("without a session, picking specialty, service, the first free slot and a time sends the patient to identify themselves and keeps the choice", async ({
  page,
}) => {
  const { specialty, service } = await clinicWithTwoProfessionals();

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: "El primer hueco libre" })
    .click();

  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAttribute(
    "aria-label",
    /^(Hoy|Mañana|\S+ \d+ de \S+) a las \d{2}:\d{2}$/,
  );
  await slot.click();

  await expect(page).toHaveURL(/\/acceder\?next=/);
  const next = new URL(page.url()).searchParams.get("next") ?? "";
  const chosen = new URL(next, WEB);
  expect(chosen.pathname).toBe("/reservar");
  expect(chosen.searchParams.get("servicio")).toBe(service.id);
  expect(chosen.searchParams.get("profesional")).toBe("cualquiera");
  expect(Date.parse(chosen.searchParams.get("inicio") ?? "")).toBeGreaterThan(
    Date.now(),
  );
  await expect(page.getByTestId("access-email")).toBeVisible();
});

test("a service that needs a deposit cannot be booked online and offers the clinic phone instead", async ({
  page,
}) => {
  const specialty = await createSpecialty();
  const service = await createService(specialty.id, {
    booking_payment: "fixed",
    booking_payment_value: 1000,
  });

  await page.goto(`${WEB}/reservar?especialidad=${specialty.id}`);

  const phoneOnly = page
    .getByTestId("booking-phone-only")
    .filter({ hasText: service.name });
  await expect(phoneOnly).toContainText("Reserva por teléfono");
  await expect(phoneOnly.getByRole("link")).toHaveAttribute(
    "href",
    "tel:+34614552808",
  );
  await expect(
    page.getByTestId("booking-service").filter({ hasText: service.name }),
  ).toHaveCount(0);
});

test("a professional without working hours offers no slots and points to the phone, while one with hours pages to the next days", async ({
  page,
}) => {
  const { specialty, service, withHours, withHoursId, withoutHours } =
    await clinicWithTwoProfessionals();

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: withoutHours })
    .click();

  await expect(page.getByTestId("booking-no-slots")).toContainText(
    "No hay huecos estos días",
  );
  await expect(
    page.getByTestId("booking-no-slots").getByRole("link"),
  ).toHaveAttribute("href", "tel:+34614552808");
  await expect(page.getByTestId("booking-slot")).toHaveCount(0);

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: withHours })
    .click();
  await expect(page.getByTestId("booking-slot").first()).toBeVisible();

  await page.getByTestId("booking-next-days").click();

  const windowStart = addDays(todayInMadrid(), 14);
  await expect(page).toHaveURL(new RegExp(`fecha=${windowStart}`));
  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAttribute("data-date", windowStart);
  expect(new URL(page.url()).searchParams.get("profesional")).toBe(withHoursId);
});

test("the booking button in the web header starts the online booking instead of the contact form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WEB);

  await page.getByRole("link", { name: "Coger cita" }).click();

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("booking-specialty").first()).toBeVisible();
});

function slotStepUrl(
  specialtyId: string,
  serviceId: string,
  professionalId: string,
  extra: string,
) {
  return `${WEB}/reservar?especialidad=${specialtyId}&servicio=${serviceId}&profesional=${professionalId}${extra}`;
}

test("a far-future or tampered date in the URL shows the slots from today instead of breaking the page", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();

  await page.goto(
    slotStepUrl(specialty.id, service.id, withHoursId, "&fecha=9999-12-25"),
  );

  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  const date = (await slot.getAttribute("data-date")) ?? "";
  expect(date < addDays(todayInMadrid(), 14)).toBe(true);
});

test("the last window before the booking horizon offers no further days, because nothing later can be booked", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const { data, error } = await admin
    .from("clinic_settings")
    .select("booking_horizon_days")
    .single();
  expect(error).toBeNull();
  const fecha = addDays(todayInMadrid(), data!.booking_horizon_days - 4);

  await page.goto(
    slotStepUrl(specialty.id, service.id, withHoursId, `&fecha=${fecha}`),
  );

  await expect(page.getByTestId("booking-slot").first()).toBeVisible();
  await expect(page.getByTestId("booking-next-days")).toHaveCount(0);
});

test("an unknown service in the URL goes back to the services of the chosen specialty", async ({
  page,
}) => {
  const { specialty, service } = await clinicWithTwoProfessionals();

  await page.goto(
    `${WEB}/reservar?especialidad=${specialty.id}&servicio=99999999-9999-9999-9999-999999999999`,
  );

  await expect(
    page.getByTestId("booking-service").filter({ hasText: service.name }),
  ).toBeVisible();
});

test("a chosen time that has already passed goes back to the slots instead of showing it as the appointment", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();

  await page.goto(
    slotStepUrl(
      specialty.id,
      service.id,
      withHoursId,
      `&inicio=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`,
    ),
  );

  await expect(page.getByTestId("booking-slot").first()).toBeVisible();
  await expect(page.getByTestId("booking-chosen")).toHaveCount(0);
});

async function openChosenSlot(page: Page, slotStep: string) {
  await page.goto(slotStep);
  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  const href = (await slot.getAttribute("href")) ?? "";
  await page.goto(`${WEB}${href}`);
  const next = new URL(page.url()).searchParams.get("next") ?? "";
  return new URL(next, WEB).searchParams.get("inicio") ?? "";
}

async function identify(page: Page, email: string) {
  await page.getByTestId("access-email").fill(email);
  await page.getByTestId("access-submit").click();
  await expect(page.getByTestId("access-sent")).toBeVisible();
  await page.getByTestId("access-code").fill(await latestCodeFor(email));
  await page.getByTestId("access-code-submit").click();
  await expect(page).toHaveURL(/\/reservar\?/);
}

async function fillPerson(
  page: Page,
  prefix: string,
  person: { first: string; last: string; birth: string; phone?: string },
) {
  await page.getByTestId(`new-person-${prefix}first_name`).fill(person.first);
  await page.getByTestId(`new-person-${prefix}last_name`).fill(person.last);
  await page.getByTestId(`new-person-${prefix}birth_date`).fill(person.birth);
  if (person.phone) {
    await page.getByTestId(`new-person-${prefix}phone`).fill(person.phone);
  }
}

async function seedPerson(email: string, firstName: string, isPatient = true) {
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: firstName,
      last_name: `Prueba ${unique()}`,
      birth_date: "1988-03-14",
      email,
      is_patient: isPatient,
    })
    .select("id, first_name, last_name")
    .single();
  expect(error).toBeNull();
  return data!;
}

test("a new patient picks a time, identifies with the emailed code, gives their details accepting privacy and gets the appointment confirmed on screen and by email", async ({
  page,
}) => {
  const { specialty, service, withHours, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = uniqueEmail("reserva-yo");

  const startsAt = await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, "cualquiera", ""),
  );
  await identify(page, email);

  await expect(page.getByTestId("booking-who")).toHaveCount(0);
  await expect(page.getByTestId("new-person-form")).toBeVisible();
  await fillPerson(page, "", {
    first: "Marta",
    last: "Reserva",
    birth: "1990-04-02",
    phone: "600111222",
  });
  await page.getByTestId("privacy-accept").check();
  await page.getByTestId("new-person-submit").click();

  await expect(page.getByTestId("booking-summary")).toContainText(
    "Marta Reserva",
  );
  await page.getByTestId("booking-confirm").click();

  await expect(page).toHaveURL(/\/reservar\/confirmada\?cita=/);
  const confirmed = page.getByTestId("booking-confirmed");
  await expect(confirmed).toContainText(withHours);
  await expect(confirmed).toContainText("Marta Reserva");

  const appointmentId = new URL(page.url()).searchParams.get("cita") ?? "";
  const { data: appointment, error } = await admin
    .from("appointments")
    .select("origin, starts_at, professional_id, service_id")
    .eq("id", appointmentId)
    .single();
  expect(error).toBeNull();
  expect(appointment!.origin).toBe("web");
  expect(appointment!.professional_id).toBe(withHoursId);
  expect(appointment!.service_id).toBe(service.id);
  expect(Date.parse(appointment!.starts_at)).toBe(Date.parse(startsAt));

  const { data: account } = await admin
    .from("patient_accounts")
    .select("privacy_version, privacy_accepted_at")
    .eq("email", email)
    .single();
  expect(account!.privacy_version).toBe("2026-09");
  expect(account!.privacy_accepted_at).not.toBeNull();

  const html = await latestEmailFor(email, "Cita confirmada");
  expect(html).toContain(service.name);
  expect(html).toContain(withHours);
  expect(html).toContain("Marta Reserva");
  expect(html).toContain("Puedes verla o cambiarla en Mi cuenta");
});

test("a mother books for her new child: she is saved as guardian without being a patient and the appointment is for the child", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = uniqueEmail("reserva-madre");

  await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, withHoursId, ""),
  );
  await identify(page, email);

  await page.getByTestId("new-person-for-minor").check();
  await fillPerson(page, "guardian_", {
    first: "Marta",
    last: "Madre",
    birth: "1985-02-10",
    phone: "600222333",
  });
  await fillPerson(page, "", {
    first: "Leo",
    last: "Madre",
    birth: addDays(todayInMadrid(), -6 * 365),
  });
  await page.getByTestId("new-person-relationship").selectOption("madre");
  await page.getByTestId("privacy-accept").check();
  await page.getByTestId("new-person-submit").click();

  await expect(page.getByTestId("booking-summary")).toContainText("Leo Madre");
  await page.getByTestId("booking-confirm").click();
  await expect(page.getByTestId("booking-confirmed")).toContainText(
    "Leo Madre",
  );

  const { data: mother } = await admin
    .from("people")
    .select("id, is_patient")
    .eq("email", email)
    .single();
  expect(mother!.is_patient).toBe(false);
  const { data: guardianship } = await admin
    .from("guardianships")
    .select("minor_id, relationship")
    .eq("guardian_id", mother!.id)
    .single();
  expect(guardianship!.relationship).toBe("madre");

  const appointmentId = new URL(page.url()).searchParams.get("cita") ?? "";
  const { data: appointment } = await admin
    .from("appointments")
    .select("patient_id, origin")
    .eq("id", appointmentId)
    .single();
  expect(appointment!.patient_id).toBe(guardianship!.minor_id);
  expect(appointment!.origin).toBe("web");
});

async function patientAtSummary(
  context: BrowserContext,
  slotStep: string,
  prefix: string,
) {
  const page = await context.newPage();
  const email = uniqueEmail(prefix);
  await seedPerson(email, prefix);
  const startsAt = await openChosenSlot(page, slotStep);
  await identify(page, email);
  await page.getByTestId("booking-person").click();
  await expect(page.getByTestId("booking-summary")).toBeVisible();
  return { page, startsAt };
}

test("two people confirming the same time at once: one gets it and the other is told it is taken and chooses again", async ({
  browser,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const slotStep = slotStepUrl(specialty.id, service.id, withHoursId, "");
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        extraHTTPHeaders: { "x-forwarded-for": randomIp() },
      }),
    ),
  );

  try {
    const first = await patientAtSummary(contexts[0]!, slotStep, "reserva-uno");
    const second = await patientAtSummary(
      contexts[1]!,
      slotStep,
      "reserva-dos",
    );
    expect(second.startsAt).toBe(first.startsAt);

    await Promise.all([
      first.page.getByTestId("booking-confirm").click(),
      second.page.getByTestId("booking-confirm").click(),
    ]);
    const outcomes = await Promise.all(
      [first.page, second.page].map(async (page) => {
        await page.waitForURL(
          (url) =>
            url.pathname === "/reservar/confirmada" ||
            url.searchParams.get("aviso") === "ocupado",
        );
        return new URL(page.url()).pathname === "/reservar/confirmada";
      }),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);

    const loser = outcomes[0] ? second.page : first.page;
    await expect(loser.getByTestId("booking-error")).toHaveText(
      "Ese hueco ya no está libre. Elige otro.",
    );
    expect(new URL(loser.url()).searchParams.get("inicio")).toBeNull();
    await expect(loser.getByTestId("booking-slot").first()).toBeVisible();

    const { data: booked, error } = await admin
      .from("appointments")
      .select("id")
      .eq("professional_id", withHoursId)
      .eq("starts_at", first.startsAt)
      .neq("status", "cancelled");
    expect(error).toBeNull();
    expect(booked).toHaveLength(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("an account the clinic created is asked to accept privacy when adding a child from the web, since it never accepted it", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = uniqueEmail("reserva-clinica");
  const mother = await seedPerson(email, "Clinica");

  await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, withHoursId, ""),
  );
  await identify(page, email);

  await expect(page.getByTestId("booking-person")).toContainText(
    mother.last_name,
  );
  await page.getByTestId("booking-other-person").click();
  await expect(page.getByTestId("privacy-accept")).toBeVisible();
  await page.getByTestId("new-person-for-minor").check();
  await expect(page.getByTestId("new-person-guardian_id")).toHaveValue(
    mother.id,
  );
  await fillPerson(page, "", {
    first: "Nico",
    last: "Clinica",
    birth: addDays(todayInMadrid(), -4 * 365),
  });
  await page.getByTestId("new-person-relationship").selectOption("madre");
  await page.getByTestId("privacy-accept").check();
  await page.getByTestId("new-person-submit").click();

  await expect(page.getByTestId("booking-summary")).toContainText(
    "Nico Clinica",
  );
  const { data: account } = await admin
    .from("patient_accounts")
    .select("privacy_version")
    .eq("email", email)
    .single();
  expect(account!.privacy_version).toBe("2026-09");
});

test("a mother saved only as guardian can later book for herself and becomes a patient", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = uniqueEmail("reserva-tutora");
  const mother = await seedPerson(email, "Tutora", false);

  await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, withHoursId, ""),
  );
  await identify(page, email);

  await page
    .getByTestId("booking-person")
    .filter({ hasText: mother.last_name })
    .click();
  await page.getByTestId("booking-confirm").click();
  await expect(page.getByTestId("booking-confirmed")).toContainText(
    mother.last_name,
  );

  const { data: person } = await admin
    .from("people")
    .select("is_patient")
    .eq("id", mother.id)
    .single();
  expect(person!.is_patient).toBe(true);
});

test("a companion the clinic saved without birth date is offered, completes only her birth date and gets booked without being duplicated", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = uniqueEmail("reserva-acompanante");
  const { data: companion, error } = await admin
    .from("people")
    .insert({
      first_name: "Acompañante",
      last_name: `Prueba ${unique()}`,
      birth_date: null,
      email,
      is_patient: false,
    })
    .select("id, last_name")
    .single();
  expect(error).toBeNull();

  await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, withHoursId, ""),
  );
  await identify(page, email);

  await page
    .getByTestId("booking-person")
    .filter({ hasText: companion!.last_name })
    .click();
  await expect(page.getByTestId("birth-date-form")).toBeVisible();
  await page.getByTestId("birth-date-input").fill("1960-03-01");
  await page.getByTestId("birth-date-submit").click();

  await expect(page.getByTestId("booking-summary")).toContainText(
    companion!.last_name,
  );
  await page.getByTestId("booking-confirm").click();
  await expect(page.getByTestId("booking-confirmed")).toContainText(
    companion!.last_name,
  );

  const { data: people } = await admin
    .from("people")
    .select("id, birth_date, is_patient")
    .eq("email", email);
  expect(people).toEqual([
    { id: companion!.id, birth_date: "1960-03-01", is_patient: true },
  ]);
});

test("a team member signed in on the panel who opens the web booking is sent to the panel instead of an error page", async ({
  page,
}) => {
  test.slow();
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const email = `reserva-equipo-${unique()}@test.local`;
  const password = "lumia-segura-2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  createdUserIds.push(data.user!.id);
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Equipo en la web",
    role: "employee",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await signIn(page, "http://localhost:3001", email, password);

  await openChosenSlot(
    page,
    slotStepUrl(specialty.id, service.id, withHoursId, ""),
  );
  await expect(page.getByTestId("booking-team-session")).toHaveText(
    "Esta dirección es del equipo de la clínica; entra desde el panel.",
  );

  await page.goto(`${WEB}/reservar/confirmada?cita=${crypto.randomUUID()}`);
  await expect(page.getByTestId("booking-team-session")).toHaveText(
    "Esta dirección es del equipo de la clínica; entra desde el panel.",
  );
});

test("another email does not see the people or appointments of an account", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const owner = await seedPerson(uniqueEmail("reserva-ajena"), "Ajena");
  const day = addDays(todayInMadrid(), 3);
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      professional_id: withHoursId,
      patient_id: owner.id,
      service_id: service.id,
      starts_at: madridInstant(day, "12:00"),
      ends_at: madridInstant(day, "12:45"),
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  const slotStep = slotStepUrl(specialty.id, service.id, withHoursId, "");
  await openChosenSlot(page, slotStep);
  await identify(page, uniqueEmail("reserva-otra"));

  await expect(page.getByTestId("new-person-form")).toBeVisible();
  await expect(page.getByTestId("booking-person")).toHaveCount(0);
  await expect(page.getByText(owner.last_name)).toHaveCount(0);

  const withOwner = new URL(page.url());
  withOwner.searchParams.set("persona", owner.id);
  await page.goto(withOwner.toString());
  await expect(page.getByTestId("booking-summary")).toHaveCount(0);
  await expect(page.getByTestId("new-person-form")).toBeVisible();

  const response = await page.goto(
    `${WEB}/reservar/confirmada?cita=${appointment!.id}`,
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("booking-confirmed")).toHaveCount(0);
});
