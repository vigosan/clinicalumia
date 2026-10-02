import { execSync } from "node:child_process";
import {
  addDays,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { pickTime } from "./date-time";
import { latestEmailFor, latestEmailIcs } from "./mail";
import { selectOption } from "./select";

const DASHBOARD = "http://localhost:3001";
const MAILPIT = "http://127.0.0.1:54324/api/v1";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";

const createdUserIds: string[] = [];
const createdPersonIds: string[] = [];

function isoWeekday(date: string): number {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function weekdayFrom(offsetDays: number): string {
  let offset = offsetDays;
  while (isoWeekday(addDays(todayInMadrid(), offset)) > 5) offset += 1;
  return addDays(todayInMadrid(), offset);
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function icsUtc(date: string, time: string): string {
  return new Date(madridInstant(date, time))
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

async function professionalWithSchedule(date: string) {
  const email = `${unique("avisos")}@test.local`;
  const password = "lumia-segura-2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  createdUserIds.push(id);
  const { error: profileError } = await admin.from("profiles").insert({
    id,
    email,
    full_name: "Profesional Avisos",
    role: "employee",
    specialty_id: PSICOLOGIA_SPECIALTY_ID,
    is_active: true,
  });
  expect(profileError).toBeNull();
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert({
      profile_id: id,
      weekday: isoWeekday(date),
      starts_at: "09:00",
      ends_at: "20:00",
    });
  expect(scheduleError).toBeNull();
  return { id, email, password };
}

async function person({
  email,
  birthDate = "1990-01-01",
}: {
  email: string | null;
  birthDate?: string;
}) {
  const lastName = unique("Aviso");
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      email,
      is_patient: true,
      birth_date: birthDate,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);
  return { id: data!.id, lastName };
}

async function appointmentFor({
  professionalId,
  patientId,
  date,
}: {
  professionalId: string;
  patientId: string;
  date: string;
}) {
  const { data, error } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      patient_id: patientId,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${date} 10:00:00 Europe/Madrid`,
      ends_at: `${date} 11:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

async function messageCount(email: string): Promise<number> {
  const { messages } = await (
    await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    )
  ).json();
  return messages.length;
}

async function openAppointment(page: Page, date: string, id: string) {
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${id}`);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
}

test.afterEach(async () => {
  if (createdUserIds.length > 0) {
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("professional_id", createdUserIds);
    expect(error).toBeNull();
  }
  const personIds = createdPersonIds.splice(0);
  if (personIds.length > 0) {
    const { error: guardiansError } = await admin
      .from("guardianships")
      .delete()
      .in("minor_id", personIds);
    expect(guardiansError).toBeNull();
    const { error } = await admin.from("people").delete().in("id", personIds);
    expect(error).toBeNull();
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

test("dar una cita desde Nueva cita con la casilla marcada envía «Cita confirmada» al paciente con un .ics que su calendario añade", async ({
  page,
}) => {
  const date = weekdayFrom(70);
  const professional = await professionalWithSchedule(date);
  const email = `${unique("confirmada")}@test.local`;
  const patient = await person({ email });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:00&professional=${professional.id}`,
  );
  await page.getByTestId("patient-search").fill(patient.lastName);
  await page
    .getByTestId("patient-option")
    .filter({ hasText: patient.lastName })
    .click();
  await expect(page.getByTestId("notify-patient")).toBeChecked();
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/[?&]appointment=/);
  await expect(page.getByTestId("toast")).toHaveText("Cita creada");
  const appointmentId = new URL(page.url()).searchParams.get("appointment");

  const html = await latestEmailFor(email, "Cita confirmada");
  expect(html).toContain(`Paciente ${patient.lastName}`);
  expect(html).toContain("Profesional Avisos");
  const ics = await latestEmailIcs(email, "Cita confirmada");
  expect(ics).toContain("METHOD:REQUEST");
  expect(ics).toContain(`UID:${appointmentId}@clinicalumia.es`);
  expect(ics).toMatch(/SEQUENCE:\d+/);
  expect(ics).toContain(`DTSTART:${icsUtc(date, "10:00")}`);
});

test("mover una cita desde el panel envía «Cita cambiada» con la hora anterior y la nueva, y un .ics que actualiza el mismo evento", async ({
  page,
}) => {
  const date = weekdayFrom(71);
  const professional = await professionalWithSchedule(date);
  const email = `${unique("cambiada")}@test.local`;
  const patient = await person({ email });
  const appointmentId = await appointmentFor({
    professionalId: professional.id,
    patientId: patient.id,
    date,
  });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await openAppointment(page, date, appointmentId);
  await expect(page.getByTestId("notify-patient")).toBeChecked();
  await pickTime(page.getByTestId("appointment-move-time"), "12:30");
  await page.getByTestId("appointment-move").click();

  await expect(page.getByTestId("toast")).toHaveText("Cita cambiada");
  const html = await latestEmailFor(email, "Cita cambiada");
  expect(html).toMatch(/<strong>Ahora:<\/strong> [^<]* a las 12:30/);
  expect(html).toMatch(/<strong>Antes:<\/strong> [^<]* a las 10:00/);
  const ics = await latestEmailIcs(email, "Cita cambiada");
  expect(ics).toContain("METHOD:REQUEST");
  expect(ics).toContain(`UID:${appointmentId}@clinicalumia.es`);
  expect(ics).toMatch(/SEQUENCE:\d+/);
  expect(ics).toContain(`DTSTART:${icsUtc(date, "12:30")}`);
});

test("cancelar la cita de un menor sin email avisa a su tutora con un .ics que la quita del calendario", async ({
  page,
}) => {
  const date = weekdayFrom(72);
  const professional = await professionalWithSchedule(date);
  const guardianEmail = `${unique("tutora")}@test.local`;
  const guardian = await person({ email: guardianEmail });
  const minor = await person({ email: null, birthDate: "2018-05-05" });
  const { error: guardianshipError } = await admin
    .from("guardianships")
    .insert({
      minor_id: minor.id,
      guardian_id: guardian.id,
      relationship: "madre",
      is_primary: true,
    });
  expect(guardianshipError).toBeNull();
  const appointmentId = await appointmentFor({
    professionalId: professional.id,
    patientId: minor.id,
    date,
  });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await openAppointment(page, date, appointmentId);
  await page.getByTestId("appointment-cancel").click();
  await page.getByTestId("cancel-by-clinic").check();
  await expect(
    page.getByRole("alertdialog").getByTestId("notify-patient"),
  ).toBeChecked();
  await page.getByTestId("cancel-confirm").click();

  await expect(page.getByTestId("toast")).toHaveText("Cita cancelada");
  const html = await latestEmailFor(guardianEmail, "Cita cancelada");
  expect(html).toContain(`Paciente ${minor.lastName}`);
  const ics = await latestEmailIcs(guardianEmail, "Cita cancelada");
  expect(ics).toContain("METHOD:CANCEL");
  expect(ics).toContain(`UID:${appointmentId}@clinicalumia.es`);
  expect(ics).toContain("STATUS:CANCELLED");
});

test("con la casilla desmarcada, mover y cancelar no envían nada al paciente", async ({
  page,
}) => {
  const date = weekdayFrom(73);
  const professional = await professionalWithSchedule(date);
  const email = `${unique("sin-aviso")}@test.local`;
  const patient = await person({ email });
  const appointmentId = await appointmentFor({
    professionalId: professional.id,
    patientId: patient.id,
    date,
  });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await openAppointment(page, date, appointmentId);
  await page.getByTestId("notify-patient").uncheck();
  await pickTime(page.getByTestId("appointment-move-time"), "12:30");
  await page.getByTestId("appointment-move").click();
  await expect(page.getByTestId("toast")).toHaveText("Cita cambiada");

  await page.getByTestId("appointment-cancel").click();
  await page.getByRole("alertdialog").getByTestId("notify-patient").uncheck();
  await page.getByTestId("cancel-confirm").click();
  await expect(page.getByTestId("toast").last()).toHaveText("Cita cancelada");

  await page.waitForTimeout(2000);
  expect(await messageCount(email)).toBe(0);
});

test("si se abre Cancelar cita mientras el cambio de hora aún se guarda, la casilla desmarcada se mantiene y no se avisa al paciente", async ({
  page,
}) => {
  const date = weekdayFrom(75);
  const professional = await professionalWithSchedule(date);
  const email = `${unique("sin-aviso-rapido")}@test.local`;
  const patient = await person({ email });
  const appointmentId = await appointmentFor({
    professionalId: professional.id,
    patientId: patient.id,
    date,
  });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await openAppointment(page, date, appointmentId);
  await page.getByTestId("notify-patient").uncheck();
  await pickTime(page.getByTestId("appointment-move-time"), "12:30");
  await page.getByTestId("appointment-move").click();
  await page.getByTestId("appointment-cancel").click();
  const cancelNotify = page
    .getByRole("alertdialog")
    .getByTestId("notify-patient");
  await cancelNotify.uncheck();
  await page.waitForTimeout(1500);

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(cancelNotify).not.toBeChecked();
  await page.getByTestId("cancel-confirm").click();
  await expect(
    page.getByTestId("toast").filter({ hasText: "Cita cambiada" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("toast").last()).toHaveText("Cita cancelada");

  await page.waitForTimeout(2000);
  expect(await messageCount(email)).toBe(0);
});

test("un paciente sin email ni tutores con email no tiene la casilla en Nueva cita, Cambiar fecha u hora ni Cancelar cita", async ({
  page,
}) => {
  const date = weekdayFrom(74);
  const professional = await professionalWithSchedule(date);
  const patient = await person({ email: null });
  const appointmentId = await appointmentFor({
    professionalId: professional.id,
    patientId: patient.id,
    date,
  });

  await signIn(page, DASHBOARD, professional.email, professional.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=12:00&patient=${patient.id}`,
  );
  await expect(page.getByTestId("patient-selected")).toContainText(
    patient.lastName,
  );
  await expect(page.getByTestId("appointment-service")).toBeVisible();
  await expect(page.getByTestId("notify-patient")).toHaveCount(0);

  await openAppointment(page, date, appointmentId);
  await expect(page.getByTestId("appointment-move-form")).toBeVisible();
  await expect(page.getByTestId("notify-patient")).toHaveCount(0);
  await page.getByTestId("appointment-cancel").click();
  await expect(page.getByTestId("cancel-reason")).toBeVisible();
  await expect(page.getByTestId("notify-patient")).toHaveCount(0);
});
