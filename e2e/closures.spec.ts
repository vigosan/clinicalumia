import { execSync } from "node:child_process";
import {
  addDays,
  madridDateTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { pickDate, pickTime } from "./date-time";
import { selectOption } from "./select";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const DASHBOARD = "http://localhost:3001";
const WEB = "http://localhost:3000";
const MARC_ID = "a0000000-0000-0000-0000-000000000003";
const FISIOTERAPIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005c1";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";

const createdUserIds: string[] = [];
const createdPersonIds: string[] = [];
const createdAppointmentIds: string[] = [];
const createdReasons: string[] = [];
const createdServiceIds: string[] = [];
const createdSpecialtyIds: string[] = [];

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
  if (createdServiceIds.length > 0) {
    const { error } = await admin
      .from("services")
      .delete()
      .in("id", createdServiceIds.splice(0));
    expect(error).toBeNull();
  }
  if (createdSpecialtyIds.length > 0) {
    const { error } = await admin
      .from("specialties")
      .delete()
      .in("id", createdSpecialtyIds.splice(0));
    expect(error).toBeNull();
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
  await page.getByTestId("closure-new").click();
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
  const drawer = page.getByRole("dialog", { name: "Nuevo día de cierre" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
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
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
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

test("a closure with no appointments in it closes the form straight away and appears in the list", async ({
  page,
}) => {
  const day = addDays(todayInMadrid(), 400 + Math.floor(Math.random() * 150));
  const reason = `Cierre limpio e2e ${uniqueSuffix()}`;
  createdReasons.push(reason);
  const owner = await createStaff("owner");

  await signIn(page, ADMIN, owner.email, owner.password);
  await page.goto(`${ADMIN}/schedules`);
  await addClosure(page, day, day, reason);

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByTestId("closure-row").filter({ hasText: reason }),
  ).toBeVisible();
});

test("the owner adds an absence from its own drawer, which closes and leaves it listed", async ({
  page,
}) => {
  const owner = await createStaff("owner");
  const day = addDays(todayInMadrid(), 300 + Math.floor(Math.random() * 150));
  const reason = `Ausencia e2e ${uniqueSuffix()}`;

  try {
    await signIn(page, ADMIN, owner.email, owner.password);
    await page.goto(`${ADMIN}/schedules?employee=${MARC_ID}`);
    await page.getByTestId("time-off-new").click();
    const form = page.getByTestId("timeoff-form");
    await pickDate(form.getByLabel("Desde"), day);
    await pickDate(form.getByLabel("Hasta"), day);
    await form.getByLabel("Motivo").fill(reason);
    await form.getByRole("button", { name: "Añadir ausencia" }).click();

    await expect(form.getByTestId("timeoff-error")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByTestId("timeoff-row").filter({ hasText: reason }),
    ).toBeVisible();
  } finally {
    await admin.from("employee_time_off").delete().eq("reason", reason);
  }
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

function isoWeekday(date: string): number {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function farWednesday() {
  let date = addDays(todayInMadrid(), 200 + Math.floor(Math.random() * 150));
  while (isoWeekday(date) !== 3) date = addDays(date, 1);
  return date;
}

async function closeClinic(from: string, to: string) {
  const reason = `Cierre e2e ${uniqueSuffix()}`;
  createdReasons.push(reason);
  const { error } = await admin
    .from("clinic_closures")
    .insert({ starts_on: from, ends_on: to, reason });
  expect(error).toBeNull();
  return reason;
}

function visibleClosure(scope: Page | Locator) {
  return scope.locator('[data-testid="agenda-closure"]:visible');
}

function weekDayFor(page: Page, date: string) {
  return page.locator(`[data-testid="week-day"][data-date="${date}"]:visible`);
}

test("the agenda marks every closed day with the reason in Day and Week, and leaves the days around it open", async ({
  page,
}) => {
  const first = farWednesday();
  const last = addDays(first, 1);
  const reason = await closeClinic(first, last);
  const owner = await createStaff("owner");

  await signIn(page, DASHBOARD, owner.email, owner.password);

  for (const date of [first, last]) {
    await page.goto(`${DASHBOARD}/?date=${date}`);
    await expect(visibleClosure(page)).toHaveText(
      `Clínica cerrada · ${reason}`,
    );
  }
  for (const date of [addDays(first, -1), addDays(last, 1)]) {
    await page.goto(`${DASHBOARD}/?date=${date}`);
    await expect(page.getByTestId("agenda-title")).toBeVisible();
    await expect(visibleClosure(page)).toHaveCount(0);
  }

  await page.goto(`${DASHBOARD}/?date=${first}&view=week`);
  for (const date of [first, last]) {
    await expect(visibleClosure(weekDayFor(page, date))).toHaveText(
      `Clínica cerrada · ${reason}`,
    );
  }
  for (const date of [addDays(first, -1), addDays(last, 1)]) {
    await expect(weekDayFor(page, date)).toBeVisible();
    await expect(visibleClosure(weekDayFor(page, date))).toHaveCount(0);
  }
  await expect(visibleClosure(page)).toHaveCount(2);
});

test("Nueva cita warns when the chosen day is closed but still gives the appointment", async ({
  page,
}) => {
  const closed = farWednesday();
  const reason = await closeClinic(closed, closed);
  const employee = await createStaff("employee");
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [2, 3].map((weekday) => ({
        profile_id: employee.id,
        weekday,
        starts_at: "09:00",
        ends_at: "14:00",
      })),
    );
  expect(scheduleError).toBeNull();
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: `Cierre${uniqueSuffix()}`,
      birth_date: "1990-01-01",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${addDays(closed, -1)}&time=10:00&professional=${employee.id}&patient=${person!.id}`,
  );
  await expect(page.getByTestId("appointment-form")).toBeVisible();
  await expect(page.getByTestId("appointment-closure-warning")).toHaveCount(0);

  await pickDate(page.getByTestId("appointment-date"), closed);
  await expect(page.getByTestId("appointment-closure-warning")).toHaveText(
    `La clínica está cerrada ese día (${reason}). Puedes dar la cita igualmente.`,
  );

  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();
  await page.waitForURL(/\/\?date=/);
  const appointmentId = new URL(page.url()).searchParams.get("appointment");
  expect(appointmentId).toBeTruthy();
  createdAppointmentIds.push(appointmentId!);

  const { data: stored } = await admin
    .from("appointments")
    .select("status, starts_at, professional_id")
    .eq("id", appointmentId!)
    .single();
  expect(stored?.status).toBe("scheduled");
  expect(stored?.professional_id).toBe(employee.id);
  expect(madridDateTime(stored!.starts_at).date).toBe(closed);
  await expect(visibleClosure(page)).toHaveText(`Clínica cerrada · ${reason}`);
});

test("the web booking offers no slot on a closed day and starts with the next open day", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
  });
  const suffix = uniqueSuffix();
  const { data: specialty, error: specialtyError } = await admin
    .from("specialties")
    .insert({ name: `Cierre web ${suffix}`, slug: `cierre-web-${suffix}` })
    .select("id")
    .single();
  expect(specialtyError).toBeNull();
  createdSpecialtyIds.push(specialty!.id);
  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      specialty_id: specialty!.id,
      name: `Sesión cierre ${suffix}`,
      duration_minutes: 45,
      price_cents: 4500,
      bookable_online: true,
    })
    .select("id")
    .single();
  expect(serviceError).toBeNull();
  createdServiceIds.push(service!.id);
  const professional = await createStaff("employee");
  const { error: profileError } = await admin
    .from("profiles")
    .update({ specialty_id: specialty!.id })
    .eq("id", professional.id);
  expect(profileError).toBeNull();
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        profile_id: professional.id,
        weekday,
        starts_at: "09:00",
        ends_at: "13:00",
      })),
    );
  expect(scheduleError).toBeNull();

  const closed = addDays(todayInMadrid(), 30 + Math.floor(Math.random() * 9));
  const slotStep = `${WEB}/reservar?especialidad=${specialty!.id}&servicio=${service!.id}&profesional=${professional.id}&fecha=${closed}`;

  await page.goto(slotStep);
  await expect(page.getByTestId("booking-slot").first()).toHaveAttribute(
    "data-date",
    closed,
  );

  await closeClinic(closed, closed);
  await page.goto(slotStep);
  await expect(page.getByTestId("booking-slot").first()).toHaveAttribute(
    "data-date",
    addDays(closed, 1),
  );
});

test("adding an absence lists the appointments that professional already has those days, without cancelling them", async ({
  page,
}) => {
  const first = farWednesday();
  const last = addDays(first, 1);
  const employee = await createStaff("employee");
  const lastName = `Ausencia${uniqueSuffix()}`;
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
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      professional_id: employee.id,
      patient_id: person!.id,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${last} 09:15:00 Europe/Madrid`,
      ends_at: `${last} 10:15:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(appointment!.id);
  const owner = await createStaff("owner");

  await signIn(page, ADMIN, owner.email, owner.password);
  await page.goto(`${ADMIN}/schedules?employee=${employee.id}`);
  const form = page.getByTestId("timeoff-form");
  await pickDate(form.getByTestId("timeoff-from"), first);
  await pickDate(form.getByTestId("timeoff-to"), last);
  await form.getByLabel("Motivo").fill("Formación");
  await form.getByRole("button", { name: "Añadir ausencia" }).click();

  const affected = page.getByTestId("timeoff-affected");
  await expect(affected).toContainText("Tiene 1 cita en esos días");
  await expect(page.getByTestId("timeoff-affected-item")).toHaveText(
    `${spanish(last)} · 09:15 · Paciente ${lastName}`,
  );
  const { data: stored } = await admin
    .from("appointments")
    .select("status")
    .eq("id", appointment!.id)
    .single();
  expect(stored?.status).toBe("scheduled");
});

test("moving an appointment to a closed day warns with the reason before saving it there", async ({
  page,
}) => {
  const closed = farWednesday();
  const open = addDays(closed, -1);
  const reason = await closeClinic(closed, closed);
  const employee = await createStaff("employee");
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [2, 3].map((weekday) => ({
        profile_id: employee.id,
        weekday,
        starts_at: "09:00",
        ends_at: "14:00",
      })),
    );
  expect(scheduleError).toBeNull();
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: `Mover${uniqueSuffix()}`,
      birth_date: "1990-01-01",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      professional_id: employee.id,
      patient_id: person!.id,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${open} 10:00:00 Europe/Madrid`,
      ends_at: `${open} 11:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(appointment!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${open}&appointment=${appointment!.id}`);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await pickDate(page.getByTestId("appointment-move-date"), closed);
  await pickTime(page.getByTestId("appointment-move-time"), "10:00");
  await page.getByTestId("appointment-move").click();

  await expect(page.getByTestId("appointment-warnings")).toContainText(
    `La clínica está cerrada ese día (${reason}).`,
  );
  const { data: before } = await admin
    .from("appointments")
    .select("starts_at")
    .eq("id", appointment!.id)
    .single();
  expect(madridDateTime(before!.starts_at).date).toBe(open);

  await page.getByTestId("appointment-confirm").click();
  await page.waitForURL(new RegExp(`date=${closed}`));
  const { data: after } = await admin
    .from("appointments")
    .select("starts_at")
    .eq("id", appointment!.id)
    .single();
  expect(madridDateTime(after!.starts_at).date).toBe(closed);
});
