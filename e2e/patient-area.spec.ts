import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  addDays,
  madridDateTime,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { latestCodeFor, latestEmailFor } from "./mail";
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

async function patientWithAppointments(prefix: string) {
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

  const place = await clinic();
  const patient = createClient(API, anonKey ?? "");
  const { error: signInError } = await patient.auth.signInWithPassword({
    email,
    password,
  });
  expect(signInError).toBeNull();
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
      p_person_id: person!.id,
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
      patient_id: person!.id,
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
    person: person!,
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

test("a patient cancels an appointment within the window: it moves to the history as cancelled by them, the account gets the email and the clinic sees it cancelled by the patient", async ({
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
