import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  addDays,
  madridDateTime,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { collectAsStaff, deleteInvoicesOfAppointments } from "./invoices";
import {
  latestCodeFor,
  latestEmailAttachments,
  latestEmailFor,
  latestEmailIcs,
} from "./mail";
import { removePatients } from "./users";

const WEB = "http://localhost:3000";
const API = "http://127.0.0.1:54321";
const CANCELLATION_HOURS = 72;

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const anonKey = env.match(/^ANON_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient(API, serviceKey ?? "");

const usedEmails: string[] = [];
const createdUserIds: string[] = [];
const createdServiceIds: string[] = [];
const createdSpecialtyIds: string[] = [];

function unique() {
  return `${Date.now()}-${randomInt(1e9)}`;
}

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${unique()}@test.local`;
  usedEmails.push(email);
  return email;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(256)}`,
  });
});

test.afterEach(async () => {
  await removePatients(admin, usedEmails.splice(0));
  const professionalIds = createdUserIds.splice(0);
  if (professionalIds.length > 0) {
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("professional_id", professionalIds);
    if (error) throw error;
  }
  for (const id of professionalIds) {
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

async function clinic() {
  const suffix = unique();
  const { data: specialty, error } = await admin
    .from("specialties")
    .insert({
      name: `Mi cuenta e2e ${suffix}`,
      slug: `mi-cuenta-e2e-${suffix}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdSpecialtyIds.push(specialty!.id);

  const serviceName = `Sesión mi cuenta ${suffix}`;
  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      specialty_id: specialty!.id,
      name: serviceName,
      duration_minutes: 45,
      price_cents: 4500,
      bookable_online: true,
      cancellation_hours: CANCELLATION_HOURS,
    })
    .select("id")
    .single();
  expect(serviceError).toBeNull();
  createdServiceIds.push(service!.id);

  const professionalEmail = `mi-cuenta-profesional-${suffix}@test.local`;
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: professionalEmail,
    email_confirm: true,
  });
  expect(userError).toBeNull();
  const professionalId = user.user!.id;
  createdUserIds.push(professionalId);
  const professionalName = `Ana Cuenta ${suffix}`;
  const { error: profileError } = await admin.from("profiles").insert({
    id: professionalId,
    email: professionalEmail,
    full_name: professionalName,
    role: "employee",
    specialty_id: specialty!.id,
    is_active: true,
  });
  expect(profileError).toBeNull();
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        profile_id: professionalId,
        weekday,
        starts_at: "09:00",
        ends_at: "13:00",
      })),
    );
  expect(scheduleError).toBeNull();

  return {
    serviceId: service!.id as string,
    serviceName,
    professionalId,
    professionalName,
  };
}

async function patientAccount(prefix: string) {
  const email = uniqueEmail(prefix);
  const password = "lumia-paciente-2026";
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const { error: accountError } = await admin
    .from("patient_accounts")
    .insert({ id: user.user!.id, email });
  expect(accountError).toBeNull();
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Marta",
      last_name: `Cuenta ${unique()}`,
      birth_date: "1988-03-14",
      email,
      phone: "600111222",
      address: "Calle Montesa 9, Xàtiva",
      is_patient: true,
    })
    .select("id, first_name, last_name")
    .single();
  expect(personError).toBeNull();

  const patient = createClient(API, anonKey ?? "");
  const { error: signInError } = await patient.auth.signInWithPassword({
    email,
    password,
  });
  expect(signInError).toBeNull();
  return { email, person: person!, patient };
}

async function patientWithAppointments(prefix: string) {
  const { email, person, patient } = await patientAccount(prefix);
  const place = await clinic();
  const { data: slots, error: slotsError } = await patient.rpc(
    "available_slots",
    {
      p_service_id: place.serviceId,
      p_professional_id: place.professionalId,
      p_from: addDays(todayInMadrid(), 5),
      p_to: addDays(todayInMadrid(), 6),
    },
  );
  expect(slotsError).toBeNull();
  const webStartsAt = slots![0].starts_at as string;
  const { data: webId, error: bookError } = await patient.rpc(
    "book_appointment",
    {
      p_person_id: person.id,
      p_service_id: place.serviceId,
      p_professional_id: place.professionalId,
      p_starts_at: webStartsAt,
    },
  );
  expect(bookError).toBeNull();

  const teamDay = addDays(todayInMadrid(), 2);
  const { data: team, error: teamError } = await admin
    .from("appointments")
    .insert({
      professional_id: place.professionalId,
      patient_id: person.id,
      service_id: place.serviceId,
      starts_at: madridInstant(teamDay, "10:00"),
      ends_at: madridInstant(teamDay, "10:45"),
    })
    .select("id, origin")
    .single();
  expect(teamError).toBeNull();
  expect(team!.origin).toBe("staff");

  return {
    email,
    person,
    place,
    web: { id: webId as string, startsAt: webStartsAt },
    teamId: team!.id as string,
  };
}

async function enterWithCode(page: Page, email: string) {
  await page.getByTestId("access-email").fill(email);
  await page.getByTestId("access-submit").click();
  await expect(page.getByTestId("access-sent")).toBeVisible();
  await page.getByTestId("access-code").fill(await latestCodeFor(email));
  await page.getByTestId("access-code-submit").click();
}

test("a patient who opens Mi cuenta without a session identifies with the code and sees the web and team appointments with the window to change them", async ({
  page,
}) => {
  const { email, person, place, web, teamId } =
    await patientWithAppointments("mi-cuenta");

  await page.goto(`${WEB}/mi-cuenta`);
  await expect(page).toHaveURL(`${WEB}/acceder?next=%2Fmi-cuenta`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const appointments = page
    .getByTestId("account-upcoming")
    .getByTestId("account-appointment");
  await expect(appointments).toHaveCount(2);

  const team = appointments.nth(0);
  await expect(team).toHaveAttribute("data-appointment-id", teamId);
  await expect(team).toContainText("10:00");
  await expect(team).toContainText(place.serviceName);
  await expect(team).toContainText(place.professionalName);
  await expect(team).toContainText(`${person.first_name} ${person.last_name}`);
  await expect(team).toContainText("Fuera de plazo: llama al 614 552 808");
  await expect(team.getByTestId("account-reschedule")).toHaveCount(0);
  await expect(team.getByTestId("account-cancel")).toHaveCount(0);

  const booked = appointments.nth(1);
  await expect(booked).toHaveAttribute("data-appointment-id", web.id);
  await expect(booked).toContainText(madridDateTime(web.startsAt).time);
  await expect(booked).toContainText(place.serviceName);
  const deadline = madridDateTime(
    new Date(
      Date.parse(web.startsAt) - CANCELLATION_HOURS * 3_600_000,
    ).toISOString(),
  );
  await expect(booked).toContainText(
    new RegExp(
      `Puedes cambiarla o cancelarla hasta el \\S+ ${Number(deadline.date.slice(8))} a las ${deadline.time}`,
    ),
  );
  await expect(booked.getByTestId("account-reschedule")).toHaveAttribute(
    "href",
    `/mi-cuenta/citas/${web.id}/cambiar`,
  );
  await expect(booked.getByTestId("account-cancel")).toHaveAttribute(
    "href",
    `/mi-cuenta/citas/${web.id}/cancelar`,
  );
  await expect(team.getByTestId("account-add-to-calendar")).toHaveAttribute(
    "href",
    `/mi-cuenta/citas/${teamId}/cita.ics`,
  );
  await expect(booked.getByTestId("account-add-to-calendar")).toHaveAttribute(
    "href",
    `/mi-cuenta/citas/${web.id}/cita.ics`,
  );

  await expect(page.getByTestId("account-people")).toContainText(
    `${person.first_name} ${person.last_name}`,
  );
  await expect(page.getByTestId("account-add-minor")).toHaveAttribute(
    "href",
    "/mi-cuenta/menores/nuevo",
  );
  const contact = page.getByTestId("account-contact");
  await expect(contact).toContainText("600111222");
  await expect(contact).toContainText("Calle Montesa 9, Xàtiva");
  await expect(contact.getByTestId("account-edit-contact")).toHaveAttribute(
    "href",
    `/mi-cuenta/contacto/${person.id}`,
  );
  await expect(page.getByTestId("account-history")).toBeVisible();

  await page.getByTestId("account-logout").click();
  await expect(page).toHaveURL(`${WEB}/`);
  await page.goto(`${WEB}/mi-cuenta`);
  await expect(page).toHaveURL(`${WEB}/acceder?next=%2Fmi-cuenta`);
});

function icsUtc(instant: string): string {
  return new Date(instant)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

test("Añadir a mi calendario downloads the appointment as a calendar file with its time", async ({
  page,
}) => {
  const { email, web } = await patientWithAppointments("calendario");

  await page.goto(`${WEB}/mi-cuenta`);
  await enterWithCode(page, email);

  const href = await page
    .locator(`[data-appointment-id="${web.id}"]`)
    .getByTestId("account-add-to-calendar")
    .getAttribute("href");
  expect(href).toBe(`/mi-cuenta/citas/${web.id}/cita.ics`);

  const response = await page.request.get(`${WEB}${href}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "text/calendar; charset=utf-8",
  );
  expect(response.headers()["content-disposition"]).toBe(
    'attachment; filename="cita.ics"',
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const body = await response.text();
  expect(body).toContain(`UID:${web.id}@clinicalumia.es`);
  expect(body).toContain(`DTSTART:${icsUtc(web.startsAt)}`);
});

test("the calendar file of another account's appointment does not exist for this account", async ({
  page,
}) => {
  const owner = await patientWithAppointments("calendario-ajena");

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, uniqueEmail("calendario-otra"));
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const response = await page.request.get(
    `${WEB}/mi-cuenta/citas/${owner.web.id}/cita.ics`,
  );
  expect(response.status()).toBe(404);
});

test("the calendar file needs a patient session", async ({ page }) => {
  const response = await page.request.get(
    `${WEB}/mi-cuenta/citas/${crypto.randomUUID()}/cita.ics`,
  );
  expect(response.status()).toBe(401);
});

test("someone who enters from /acceder lands on Mi cuenta and, with another email, sees none of another account's appointments", async ({
  page,
}) => {
  const owner = await patientWithAppointments("mi-cuenta-ajena");

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, uniqueEmail("mi-cuenta-otra"));

  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);
  await expect(page.getByTestId("account-appointment")).toHaveCount(0);
  await expect(page.getByTestId("account-upcoming")).toContainText(
    "Todavía no tienes citas",
  );
  await expect(
    page
      .getByTestId("account-upcoming")
      .getByRole("link", { name: /Reservar/ }),
  ).toHaveAttribute("href", "/reservar");
  await expect(page.getByText(owner.person.last_name)).toHaveCount(0);
  await expect(page.getByText(owner.place.serviceName)).toHaveCount(0);
});

test("a patient cancels an appointment within the window: it moves to the history as cancelled by them, the account gets the email with a cancellation of the calendar event and the clinic sees it cancelled by the patient", async ({
  page,
}) => {
  const { email, place, web } = await patientWithAppointments("cancelar");
  const cancelPath = `/mi-cuenta/citas/${web.id}/cancelar`;

  await page.goto(`${WEB}${cancelPath}`);
  await expect(page).toHaveURL(
    `${WEB}/acceder?next=${encodeURIComponent(cancelPath)}`,
  );
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${cancelPath}`);

  const summary = page.getByTestId("cancel-summary");
  await expect(summary).toContainText(madridDateTime(web.startsAt).time);
  await expect(summary).toContainText(place.serviceName);
  await expect(summary).toContainText("Puedes cambiarla o cancelarla hasta");
  await page.getByTestId("cancel-confirm").click();

  await expect(page).toHaveURL(`${WEB}/mi-cuenta?aviso=cancelada`);
  await expect(page.getByTestId("account-notice")).toHaveText("Cita cancelada");
  await expect(page.locator(`[data-appointment-id="${web.id}"]`)).toHaveCount(
    0,
  );
  await expect(page.getByTestId("account-history")).toContainText(
    "Cancelada por ti",
  );

  const html = await latestEmailFor(email, "Cita cancelada");
  expect(html).toContain(place.serviceName);
  const cancelIcs = await latestEmailIcs(email, "Cita cancelada");
  expect(cancelIcs).toContain("METHOD:CANCEL");
  expect(cancelIcs).toContain(`UID:${web.id}@clinicalumia.es`);
  expect(cancelIcs).toContain("STATUS:CANCELLED");

  const { data: row, error } = await admin
    .from("appointments")
    .select("status, cancelled_by, cancel_reason")
    .eq("id", web.id)
    .single();
  expect(error).toBeNull();
  expect(row).toEqual({
    status: "cancelled",
    cancelled_by: "patient",
    cancel_reason: "",
  });
});

test("the cancel page of an appointment outside the window only gives the phone, because the web can no longer cancel it", async ({
  page,
}) => {
  const { email, teamId } = await patientWithAppointments("cancelar-fuera");
  const cancelPath = `/mi-cuenta/citas/${teamId}/cancelar`;

  await page.goto(`${WEB}${cancelPath}`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${cancelPath}`);

  await expect(page.getByTestId("cancel-summary")).toContainText(
    "Fuera de plazo: llama al 614 552 808",
  );
  await expect(page.getByTestId("cancel-confirm")).toHaveCount(0);
});

test("an appointment already paid and invoiced is changed only by phone: Mi cuenta and the cancel page give the phone instead of the buttons", async ({
  page,
}) => {
  const { email, place, web } = await patientWithAppointments("pagada");
  collectAsStaff(place.professionalId, web.id, 4500);
  try {
    await page.goto(`${WEB}/mi-cuenta`);
    await enterWithCode(page, email);
    const paid = page.locator(`[data-appointment-id="${web.id}"]`);
    await expect(paid).toContainText(
      "Esta cita ya está pagada. Para cambiarla o cancelarla, llama a la clínica al 614 552 808.",
    );
    await expect(paid.getByTestId("account-reschedule")).toHaveCount(0);
    await expect(paid.getByTestId("account-cancel")).toHaveCount(0);

    await page.goto(`${WEB}/mi-cuenta/citas/${web.id}/cancelar`);
    await expect(page.getByTestId("cancel-summary")).toContainText(
      "Esta cita ya está pagada. Para cambiarla o cancelarla, llama a la clínica al 614 552 808.",
    );
    await expect(page.getByTestId("cancel-confirm")).toHaveCount(0);
  } finally {
    deleteInvoicesOfAppointments([web.id]);
    const { error } = await admin
      .from("payments")
      .delete()
      .eq("appointment_id", web.id);
    expect(error).toBeNull();
  }
});

test("the cancel page of another account's appointment does not exist for this account", async ({
  page,
}) => {
  const owner = await patientWithAppointments("cancelar-ajena");

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, uniqueEmail("cancelar-otra"));
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const response = await page.goto(
    `${WEB}/mi-cuenta/citas/${owner.web.id}/cancelar`,
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("cancel-confirm")).toHaveCount(0);
  await expect(page.getByText(owner.place.serviceName)).toHaveCount(0);
});

async function chooseFirstOfferedSlot(page: Page) {
  const slot = page.getByTestId("booking-slot").first();
  const href = await slot.getAttribute("href");
  const startsAt = new URL(href ?? "", WEB).searchParams.get("inicio") ?? "";
  await slot.click();
  await expect(page.getByTestId("reschedule-confirm")).toBeVisible();
  return startsAt;
}

function dayAndTime(instant: string) {
  const { date, time } = madridDateTime(instant);
  return new RegExp(`\\b${Number(date.slice(8))} de \\S+ a las ${time}`);
}

test("a patient moves an appointment 15 minutes later, overlapping only itself: Mi cuenta shows the new time, the account gets «Cita cambiada» with both times and it keeps its length", async ({
  page,
}) => {
  const { email, place, web } = await patientWithAppointments("cambiar");
  const changePath = `/mi-cuenta/citas/${web.id}/cambiar`;

  await page.goto(`${WEB}${changePath}`);
  await expect(page).toHaveURL(
    `${WEB}/acceder?next=${encodeURIComponent(changePath)}`,
  );
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${changePath}`);

  const current = page.getByTestId("reschedule-current");
  await expect(current).toContainText(dayAndTime(web.startsAt));
  await expect(current).toContainText(place.serviceName);
  await expect(current).toContainText(place.professionalName);

  const currentStart = madridDateTime(web.startsAt);
  const quarterLater = madridDateTime(
    new Date(Date.parse(web.startsAt) + 15 * 60_000).toISOString(),
  );
  await page
    .getByTestId("booking-day")
    .filter({
      hasText: new RegExp(`^\\S+ ${Number(currentStart.date.slice(8))} de `),
    })
    .click();
  const sameDay = page.locator(
    `[data-testid="booking-slot"][data-date="${currentStart.date}"]`,
  );
  await expect(sameDay.filter({ hasText: currentStart.time })).toHaveCount(0);
  const overlapping = sameDay.filter({ hasText: quarterLater.time });
  const href = await overlapping.getAttribute("href");
  const newStart = new URL(href ?? "", WEB).searchParams.get("inicio") ?? "";
  expect(Date.parse(newStart)).toBe(Date.parse(web.startsAt) + 15 * 60_000);
  await overlapping.click();
  await expect(page.getByTestId("reschedule-confirm")).toBeVisible();
  const summary = page.getByTestId("reschedule-summary");
  await expect(summary).toContainText(dayAndTime(web.startsAt));
  await expect(summary).toContainText(dayAndTime(newStart));
  await page.getByTestId("reschedule-confirm").click();

  await expect(page).toHaveURL(`${WEB}/mi-cuenta?aviso=cambiada`);
  await expect(page.getByTestId("account-notice")).toHaveText("Cita cambiada");
  await expect(page.locator(`[data-appointment-id="${web.id}"]`)).toContainText(
    dayAndTime(newStart),
  );

  const html = await latestEmailFor(email, "Cita cambiada");
  expect(html).toMatch(dayAndTime(newStart));
  expect(html).toMatch(dayAndTime(web.startsAt));
  expect(html).toContain(place.serviceName);
  const attachments = await latestEmailAttachments(email, "Cita cambiada");
  expect(attachments).toContain("cita.ics");
  const ics = await latestEmailIcs(email, "Cita cambiada");
  expect(ics).toContain("METHOD:REQUEST");
  expect(ics).toContain(`UID:${web.id}@clinicalumia.es`);
  expect(ics).toMatch(/SEQUENCE:\d+/);
  expect(ics).toContain(`DTSTART:${icsUtc(newStart)}`);

  const { data: row, error } = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", web.id)
    .single();
  expect(error).toBeNull();
  expect(Date.parse(row!.starts_at)).toBe(Date.parse(newStart));
  expect(Date.parse(row!.ends_at) - Date.parse(row!.starts_at)).toBe(
    45 * 60_000,
  );
});

test("if another patient takes the chosen slot before the change is confirmed, the patient is told and chooses again while the appointment keeps its time", async ({
  page,
}) => {
  const { email, place, web } =
    await patientWithAppointments("cambiar-carrera");
  const changePath = `/mi-cuenta/citas/${web.id}/cambiar`;

  await page.goto(`${WEB}${changePath}`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${changePath}`);
  const newStart = await chooseFirstOfferedSlot(page);

  const other = await patientAccount("cambiar-otro");
  const { error: bookError } = await other.patient.rpc("book_appointment", {
    p_person_id: other.person.id,
    p_service_id: place.serviceId,
    p_professional_id: place.professionalId,
    p_starts_at: newStart,
  });
  expect(bookError).toBeNull();

  await page.getByTestId("reschedule-confirm").click();
  await expect(page.getByTestId("account-error")).toHaveText(
    "Ese hueco ya no está libre. Elige otro.",
  );
  await expect(page).not.toHaveURL(/inicio=/);
  await expect(page.getByTestId("reschedule-confirm")).toHaveCount(0);
  await expect(page.getByTestId("booking-slot").first()).toBeVisible();

  const { data: row, error } = await admin
    .from("appointments")
    .select("starts_at")
    .eq("id", web.id)
    .single();
  expect(error).toBeNull();
  expect(Date.parse(row!.starts_at)).toBe(Date.parse(web.startsAt));
});

test("the change page of an appointment outside the window only gives the phone, because the web can no longer move it", async ({
  page,
}) => {
  const { email, teamId } = await patientWithAppointments("cambiar-fuera");
  const changePath = `/mi-cuenta/citas/${teamId}/cambiar`;

  await page.goto(`${WEB}${changePath}`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${changePath}`);

  await expect(page.getByTestId("reschedule-current")).toContainText(
    "Fuera de plazo: llama al 614 552 808",
  );
  await expect(page.getByTestId("booking-slot")).toHaveCount(0);
  await expect(page.getByTestId("reschedule-confirm")).toHaveCount(0);
});

test("the change page of another account's appointment does not exist for this account", async ({
  page,
}) => {
  const owner = await patientWithAppointments("cambiar-ajena");

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, uniqueEmail("cambiar-otra"));
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const response = await page.goto(
    `${WEB}/mi-cuenta/citas/${owner.web.id}/cambiar`,
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("booking-slot")).toHaveCount(0);
  await expect(page.getByText(owner.place.serviceName)).toHaveCount(0);
});

test("an appointment the clinic booked for a service not offered online can be cancelled in time but only moved by phone", async ({
  page,
}) => {
  const { email, person, place } =
    await patientWithAppointments("cambiar-telefono");
  const { data: bookable, error: serviceError } = await admin
    .from("services")
    .select("specialty_id")
    .eq("id", place.serviceId)
    .single();
  expect(serviceError).toBeNull();
  const { data: offline, error: offlineError } = await admin
    .from("services")
    .insert({
      specialty_id: bookable!.specialty_id,
      name: `Valoración presencial ${unique()}`,
      duration_minutes: 60,
      price_cents: 6000,
      bookable_online: false,
      cancellation_hours: CANCELLATION_HOURS,
    })
    .select("id")
    .single();
  expect(offlineError).toBeNull();
  createdServiceIds.push(offline!.id);
  const day = addDays(todayInMadrid(), 8);
  const { data: team, error: teamError } = await admin
    .from("appointments")
    .insert({
      professional_id: place.professionalId,
      patient_id: person.id,
      service_id: offline!.id,
      starts_at: madridInstant(day, "11:00"),
      ends_at: madridInstant(day, "12:00"),
    })
    .select("id")
    .single();
  expect(teamError).toBeNull();
  const changePath = `/mi-cuenta/citas/${team!.id}/cambiar`;

  await page.goto(`${WEB}${changePath}`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${changePath}`);

  await expect(page.getByTestId("reschedule-phone-only")).toHaveText(
    "Esta cita no se puede cambiar desde la web. Llama al 614 552 808.",
  );
  await expect(page.getByTestId("booking-slot")).toHaveCount(0);
  await expect(page.getByTestId("reschedule-confirm")).toHaveCount(0);
});

async function firstSlot(
  patient: Awaited<ReturnType<typeof patientAccount>>["patient"],
  place: Awaited<ReturnType<typeof clinic>>,
) {
  const { data: slots, error } = await patient.rpc("available_slots", {
    p_service_id: place.serviceId,
    p_professional_id: place.professionalId,
    p_from: addDays(todayInMadrid(), 5),
    p_to: addDays(todayInMadrid(), 6),
  });
  expect(error).toBeNull();
  return slots![0].starts_at as string;
}

test("a patient adds a minor under their own adult from Mi cuenta: the minor shows in Personas and can then be chosen when booking", async ({
  page,
}) => {
  const { email, person, patient } = await patientAccount("menor");
  const place = await clinic();
  const startsAt = await firstSlot(patient, place);
  const newMinorPath = "/mi-cuenta/menores/nuevo";
  const minorLastName = `Menor ${unique()}`;

  await page.goto(`${WEB}${newMinorPath}`);
  await expect(page).toHaveURL(
    `${WEB}/acceder?next=${encodeURIComponent(newMinorPath)}`,
  );
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}${newMinorPath}`);

  await expect(page.getByTestId("new-person-for-me")).toHaveCount(0);
  await expect(page.getByTestId("new-person-guardian_id")).toHaveValue(
    person.id,
  );
  await page.getByTestId("new-person-first_name").fill("Leo");
  await page.getByTestId("new-person-last_name").fill(minorLastName);
  await page.getByTestId("new-person-birth_date").fill("2019-06-10");
  await page.getByTestId("new-person-relationship").selectOption("madre");
  await page.getByTestId("privacy-accept").check();
  await page.getByTestId("new-person-submit").click();

  await expect(page).toHaveURL(`${WEB}/mi-cuenta?aviso=menor`);
  await expect(page.getByTestId("account-notice")).toHaveText("Menor añadido");
  await expect(page.getByTestId("account-people")).toContainText(
    `Leo ${minorLastName}`,
  );

  const { data: minor, error } = await admin
    .from("people")
    .select("id, email")
    .eq("last_name", minorLastName)
    .single();
  expect(error).toBeNull();
  expect(minor!.email).toBeNull();
  const { data: guardianships, error: guardianshipsError } = await admin
    .from("guardianships")
    .select("guardian_id, relationship")
    .eq("minor_id", minor!.id);
  expect(guardianshipsError).toBeNull();
  expect(guardianships).toEqual([
    { guardian_id: person.id, relationship: "madre" },
  ]);

  await page.goto(
    `${WEB}/reservar?servicio=${place.serviceId}&profesional=${place.professionalId}&inicio=${encodeURIComponent(startsAt)}`,
  );
  await page
    .getByTestId("booking-person")
    .filter({ hasText: `Leo ${minorLastName}` })
    .click();
  await expect(page.getByTestId("booking-summary")).toContainText(
    `Leo ${minorLastName}`,
  );
});

test("an account without any adult yet gives the adult's details first and then the minor's, and both show in Personas", async ({
  page,
}) => {
  const email = uniqueEmail("menor-sin-adulto");
  const lastName = `Sin adulto ${unique()}`;

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);
  await page.getByTestId("account-add-minor").click();
  await expect(page).toHaveURL(`${WEB}/mi-cuenta/menores/nuevo`);

  await expect(page.getByTestId("new-person-guardian_id")).toHaveCount(0);
  await page.getByTestId("new-person-guardian_first_name").fill("Marta");
  await page.getByTestId("new-person-guardian_last_name").fill(lastName);
  await page.getByTestId("new-person-guardian_birth_date").fill("1988-03-14");
  await page.getByTestId("new-person-guardian_phone").fill("600 111 222");
  await page.getByTestId("new-person-first_name").fill("Leo");
  await page.getByTestId("new-person-last_name").fill(lastName);
  await page.getByTestId("new-person-birth_date").fill("2019-06-10");
  await page.getByTestId("new-person-relationship").selectOption("padre");
  await page.getByTestId("privacy-accept").check();
  await page.getByTestId("new-person-submit").click();

  await expect(page).toHaveURL(`${WEB}/mi-cuenta?aviso=menor`);
  const people = page.getByTestId("account-people");
  await expect(people).toContainText(`Marta ${lastName}`);
  await expect(people).toContainText(`Leo ${lastName}`);
  await expect(page.getByTestId("account-contact")).toContainText("600111222");

  const { data: adult, error } = await admin
    .from("people")
    .select("is_patient")
    .eq("email", email)
    .single();
  expect(error).toBeNull();
  expect(adult!.is_patient).toBe(false);
});

test("a patient changes their phone and address from Mi cuenta: an invalid phone is refused and the new details show in Mi cuenta and reach the clinic", async ({
  page,
}) => {
  const { email, person } = await patientAccount("contacto");
  const newAddress = `Calle Nueva ${unique()}, Xàtiva`;

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);
  await page.getByTestId("account-edit-contact").click();
  await expect(page).toHaveURL(`${WEB}/mi-cuenta/contacto/${person.id}`);

  await expect(page.getByTestId("contact-phone")).toHaveValue("600111222");
  await expect(page.getByTestId("contact-address")).toHaveValue(
    "Calle Montesa 9, Xàtiva",
  );

  await page.getByTestId("contact-phone").fill("123");
  await page.getByTestId("contact-address").fill(newAddress);
  await page.getByTestId("contact-submit").click();
  await expect(page.getByTestId("account-error")).toHaveText(
    "Escribe un teléfono válido.",
  );
  await expect(page.getByTestId("contact-address")).toHaveValue(newAddress);

  await page.getByTestId("contact-phone").fill("611 222 333");
  await page.getByTestId("contact-submit").click();

  await expect(page).toHaveURL(`${WEB}/mi-cuenta?aviso=contacto`);
  await expect(page.getByTestId("account-notice")).toHaveText(
    "Datos guardados",
  );
  const contact = page.getByTestId("account-contact");
  await expect(contact).toContainText("611222333");
  await expect(contact).toContainText(newAddress);

  const { data: row, error } = await admin
    .from("people")
    .select("phone, address")
    .eq("id", person.id)
    .single();
  expect(error).toBeNull();
  expect(row).toEqual({ phone: "611222333", address: newAddress });
});

async function withoutJavaScript(browser: Browser, page: Page) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  return { context, noScript: await context.newPage() };
}

test("a contact form sent before the page has loaded its scripts still reaches the server instead of putting the phone and address in the URL", async ({
  browser,
  page,
}) => {
  const { email, person } = await patientAccount("contacto-sin-js");
  const newAddress = `Calle Sin Script ${unique()}, Xàtiva`;
  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const { context, noScript } = await withoutJavaScript(browser, page);
  try {
    await noScript.goto(`${WEB}/mi-cuenta/contacto/${person.id}`);
    await noScript.getByTestId("contact-phone").fill("123");
    await noScript.getByTestId("contact-submit").click();
    await expect(noScript.getByTestId("account-error")).toHaveText(
      "Escribe un teléfono válido.",
    );
    expect(noScript.url()).toBe(`${WEB}/mi-cuenta/contacto/${person.id}`);

    await noScript.getByTestId("contact-phone").fill("611 222 333");
    await noScript.getByTestId("contact-address").fill(newAddress);
    await noScript.getByTestId("contact-submit").click();
    await expect(noScript).toHaveURL(`${WEB}/mi-cuenta?aviso=contacto`);
  } finally {
    await context.close();
  }

  const { data: row, error } = await admin
    .from("people")
    .select("phone, address")
    .eq("id", person.id)
    .single();
  expect(error).toBeNull();
  expect(row).toEqual({ phone: "611222333", address: newAddress });
});

test("a new minor form sent before the page has loaded its scripts still reaches the server instead of putting the family's details in the URL", async ({
  browser,
  page,
}) => {
  const email = uniqueEmail("menor-sin-js");
  const lastName = `Sin script ${unique()}`;
  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, email);
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const { context, noScript } = await withoutJavaScript(browser, page);
  try {
    await noScript.goto(`${WEB}/mi-cuenta/menores/nuevo`);
    await noScript.getByTestId("new-person-guardian_first_name").fill("Marta");
    await noScript.getByTestId("new-person-guardian_last_name").fill(lastName);
    await noScript
      .getByTestId("new-person-guardian_birth_date")
      .fill("1988-03-14");
    await noScript.getByTestId("new-person-guardian_phone").fill("600 111 222");
    await noScript.getByTestId("new-person-first_name").fill("Leo");
    await noScript.getByTestId("new-person-last_name").fill(lastName);
    await noScript.getByTestId("new-person-birth_date").fill("2019-06-10");
    await noScript.getByTestId("new-person-relationship").selectOption("padre");
    await noScript.getByTestId("privacy-accept").check();
    await noScript.getByTestId("new-person-submit").click();

    await expect(noScript).toHaveURL(`${WEB}/mi-cuenta?aviso=menor`);
    await expect(noScript.getByTestId("account-people")).toContainText(
      `Leo ${lastName}`,
    );
  } finally {
    await context.close();
  }
});

test("the contact page of a person of another account does not exist for this account", async ({
  page,
}) => {
  const owner = await patientAccount("contacto-ajeno");

  await page.goto(`${WEB}/acceder`);
  await enterWithCode(page, uniqueEmail("contacto-otra"));
  await expect(page).toHaveURL(`${WEB}/mi-cuenta`);

  const response = await page.goto(
    `${WEB}/mi-cuenta/contacto/${owner.person.id}`,
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("contact-phone")).toHaveCount(0);
  await expect(page.getByText("Calle Montesa 9")).toHaveCount(0);
});

test("the public web links to Mi cuenta from the header, the mobile menu and the footer, so a patient without the email can still get in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WEB);
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Mi cuenta" }),
  ).toHaveAttribute("href", "/mi-cuenta");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Mi cuenta" }),
  ).toHaveAttribute("href", "/mi-cuenta");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("menu-toggle").click();
  await page
    .getByTestId("mobile-menu")
    .getByRole("link", { name: "Mi cuenta" })
    .click();
  await expect(page).toHaveURL(/\/(mi-cuenta|acceder)/);
});
