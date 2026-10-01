import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const DASHBOARD = "http://localhost:3001";
const MARC_ID = "a0000000-0000-0000-0000-000000000003";
const FISIOTERAPIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005c1";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";

const createdUserIds: string[] = [];
const createdPersonIds: string[] = [];
const createdAppointmentIds: string[] = [];
const createdReasons: string[] = [];

test.afterEach(async () => {
  if (createdReasons.length > 0) {
    const { error } = await admin
      .from("clinic_closures")
      .delete()
      .in("reason", createdReasons.splice(0));
    expect(error).toBeNull();
  }
  if (createdAppointmentIds.length > 0) {
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("id", createdAppointmentIds.splice(0));
    expect(error).toBeNull();
  }
  if (createdPersonIds.length > 0) {
    const { error } = await admin
      .from("people")
      .delete()
      .in("id", createdPersonIds.splice(0));
    expect(error).toBeNull();
  }
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

async function createStaff(role: "owner" | "employee") {
  const email = `cierres-${role}-${uniqueSuffix()}@test.local`;
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
    full_name: role === "owner" ? "Propietaria Cierres" : "Empleada Cierres",
    role,
    specialty_id: role === "employee" ? PSICOLOGIA_SPECIALTY_ID : null,
    is_active: true,
  });
  expect(profileError).toBeNull();
  return { id: data.user!.id, email, password };
}

async function createAppointmentOn(date: string) {
  const lastName = `Cierre${uniqueSuffix()}`;
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      birth_date: "1990-01-01",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);
  const { data, error } = await admin
    .from("appointments")
    .insert({
      professional_id: MARC_ID,
      patient_id: person!.id,
      service_id: FISIOTERAPIA_SERVICE_ID,
      starts_at: `${date} 10:30:00 Europe/Madrid`,
      ends_at: `${date} 11:30:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(data!.id);
  return { id: data!.id, patient: `Paciente ${lastName}` };
}

async function pickRange(trigger: Locator, from: string, to: string) {
  await trigger.click();
  const page = trigger.page();
  const calendar = page
    .getByRole("dialog")
    .filter({ has: page.locator("[data-day]") });
  for (const date of [from, to]) {
    const day = calendar.locator(`[data-day="${date}"]:not([data-outside])`);
    for (let step = 0; step < 24 && (await day.count()) === 0; step++) {
      const shown = await calendar
        .locator("[data-day]:not([data-outside])")
        .first()
        .getAttribute("data-day");
      await calendar
        .getByRole("button", {
          name: date > (shown ?? "") ? /mes siguiente/i : /mes anterior/i,
        })
        .click();
    }
    await day.getByRole("button").click();
  }
  await expect(calendar).toBeHidden();
}

async function addClosure(
  page: Page,
  from: string,
  to: string,
  reason: string,
) {
  const form = page.getByTestId("closure-form");
  await pickRange(form.getByTestId("closure-range"), from, to);
  await form.getByLabel("Motivo").fill(reason);
  await form.getByRole("button", { name: "Añadir cierre" }).click();
}

function spanish(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

test("the owner closes days that already have an appointment, sees it listed without it being cancelled, cannot overlap the closure and then deletes it", async ({
  page,
}) => {
  const first = addDays(todayInMadrid(), 200 + Math.floor(Math.random() * 150));
  const last = addDays(first, 2);
  const appointment = await createAppointmentOn(addDays(first, 1));
  const reason = `Cierre e2e ${uniqueSuffix()}`;
  createdReasons.push(reason);
  const owner = await createStaff("owner");

  await signIn(page, ADMIN, owner.email, owner.password);
  await page.goto(`${ADMIN}/schedules`);
  await addClosure(page, first, last, reason);

  const affected = page.getByTestId("closure-affected");
  await expect(affected).toContainText("Hay 1 cita en esos días");
  await expect(affected).toContainText(
    `${spanish(addDays(first, 1))} · 10:30 · ${appointment.patient} · Marc Ejemplo`,
  );
  const row = page.getByTestId("closure-row").filter({ hasText: reason });
  await expect(row).toHaveText(
    new RegExp(`${spanish(first)} – ${spanish(last)} · ${reason}`),
  );

  const { data: stored } = await admin
    .from("appointments")
    .select("status, cancelled_at")
    .eq("id", appointment.id)
    .single();
  expect(stored).toEqual({ status: "scheduled", cancelled_at: null });

  const overlapReason = `Solape e2e ${uniqueSuffix()}`;
  createdReasons.push(overlapReason);
  await addClosure(page, last, addDays(last, 1), overlapReason);
  await expect(page.getByTestId("closure-error")).toHaveText(
    "Ya hay un cierre en esas fechas.",
  );
  await expect(
    page.getByTestId("closure-row").filter({ hasText: overlapReason }),
  ).toHaveCount(0);

  await row.getByTestId("closure-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(row).toHaveCount(0);
  const { data: remaining } = await admin
    .from("clinic_closures")
    .select("id")
    .eq("reason", reason);
  expect(remaining).toEqual([]);
});

test("an employee signed in to the panel cannot reach the closures in the admin", async ({
  page,
}) => {
  const employee = await createStaff("employee");
  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${ADMIN}/schedules`);
  await expect(page).toHaveURL(`${ADMIN}/login`);
  await expect(page.getByTestId("closure-form")).toHaveCount(0);
});
