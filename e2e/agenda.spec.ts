import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const PATRICIA_ID = "a0000000-0000-0000-0000-000000000001";
const MARC_ID = "a0000000-0000-0000-0000-000000000003";
const LAURA_ID = "a0000000-0000-0000-0000-000000000002";
const JORGE_ID = "a0000000-0000-0000-0000-000000000604";
const ELENA_ID = "a0000000-0000-0000-0000-000000000605";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";
const FISIOTERAPIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005c1";

const createdAppointmentIds: string[] = [];
const createdTimeOffIds: string[] = [];
const createdUserIds: string[] = [];

function visibleColumns(page: Page) {
  return page.locator('[data-testid="agenda-column"]:visible');
}

function columnFor(page: Page, professionalId: string) {
  return page.locator(
    `[data-testid="agenda-column"][data-professional="${professionalId}"]:visible`,
  );
}

function visibleWeekDays(page: Page) {
  return page.locator('[data-testid="week-day"]:visible');
}

function weekDayFor(page: Page, date: string) {
  return page.locator(`[data-testid="week-day"][data-date="${date}"]:visible`);
}

function futureDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function createAppointment({
  professionalId,
  patientId,
  serviceId,
  date,
  time,
  endTime,
}: {
  professionalId: string;
  patientId: string;
  serviceId: string;
  date: string;
  time: string;
  endTime: string;
}) {
  const { data, error } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      patient_id: patientId,
      service_id: serviceId,
      starts_at: `${date} ${time}:00 Europe/Madrid`,
      ends_at: `${date} ${endTime}:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(data!.id);
  return data!.id;
}

async function createThrowawayUser({
  fullName,
  role,
  specialtyId,
}: {
  fullName: string;
  role: "owner" | "employee";
  specialtyId?: string;
}) {
  const email = `agenda-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
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
    full_name: fullName,
    role,
    specialty_id: specialtyId ?? null,
    is_active: true,
  });
  expect(profileError).toBeNull();
  return { id: data.user!.id, email, password };
}

async function loginAsThrowawayEmployee(page: Page, fullName: string) {
  const employee = await createThrowawayUser({
    fullName,
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await signIn(page, DASHBOARD, employee.email, employee.password);
  return employee.id;
}

async function loginAsThrowawayOwner(page: Page, fullName: string) {
  const owner = await createThrowawayUser({ fullName, role: "owner" });
  await signIn(page, DASHBOARD, owner.email, owner.password);
  return owner.id;
}

test.afterEach(async () => {
  if (createdAppointmentIds.length > 0) {
    await admin
      .from("appointments")
      .delete()
      .in("id", createdAppointmentIds.splice(0));
  }
  if (createdTimeOffIds.length > 0) {
    await admin
      .from("employee_time_off")
      .delete()
      .in("id", createdTimeOffIds.splice(0));
  }
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

test("la portada muestra la agenda de hoy con su columna y su nombre", async ({
  page,
}) => {
  const employeeId = await loginAsThrowawayEmployee(page, "Profesional Uno");
  await expect(page.getByTestId("agenda-title")).toBeVisible();

  await expect(visibleColumns(page)).toHaveCount(1);
  await expect(columnFor(page, employeeId)).toContainText("Profesional Uno");
});

test("agenda-next pasa al día siguiente y actualiza el título", async ({
  page,
}) => {
  await loginAsThrowawayEmployee(page, "Profesional Dos");
  const initialTitle = await page.getByTestId("agenda-title").textContent();

  await page.getByTestId("agenda-next").click();

  await expect(page.getByTestId("agenda-title")).not.toHaveText(
    initialTitle ?? "",
  );
});

test("una cita creada para el futuro aparece como appointment-block con el nombre del paciente", async ({
  page,
}) => {
  const date = futureDate(40);
  const employee = await createThrowawayUser({
    fullName: "Profesional Tres",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}`);

  const appointment = columnFor(page, employee.id).getByTestId(
    "appointment-block",
  );
  await expect(appointment).toBeVisible();
  await expect(appointment).toContainText("Jorge Ruiz Pérez");
});

test('activar a Marc en "Ver también" muestra su columna con un busy-block sin el nombre del paciente', async ({
  page,
}) => {
  const date = futureDate(41);
  await createAppointment({
    professionalId: MARC_ID,
    patientId: ELENA_ID,
    serviceId: FISIOTERAPIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await loginAsThrowawayEmployee(page, "Profesional Cuatro");
  await page.goto(`${DASHBOARD}/?date=${date}`);

  await expect(visibleColumns(page)).toHaveCount(1);

  const seeAlso = page.getByTestId("see-also");
  await seeAlso
    .getByTestId("see-also-option")
    .filter({ hasText: "Marc Ejemplo" })
    .getByRole("checkbox")
    .check();

  const marcColumn = columnFor(page, MARC_ID);
  await expect(marcColumn).toBeVisible();
  const busyBlock = marcColumn.getByTestId("busy-block");
  await expect(busyBlock).toBeVisible();
  await expect(busyBlock).not.toContainText("Elena");
  await expect(marcColumn.getByTestId("appointment-block")).toHaveCount(0);
});

test("la propietaria ve la columna de todas y el nombre del paciente de las citas de Laura", async ({
  page,
}) => {
  const date = futureDate(42);
  await createAppointment({
    professionalId: LAURA_ID,
    patientId: ELENA_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await loginAsThrowawayOwner(page, "Propietaria de prueba");
  await page.goto(`${DASHBOARD}/?date=${date}`);

  await expect(columnFor(page, PATRICIA_ID)).toContainText("Patricia Hernán");
  await expect(columnFor(page, MARC_ID)).toContainText("Marc Ejemplo");

  const lauraColumn = columnFor(page, LAURA_ID);
  await expect(lauraColumn).toContainText("Laura Ejemplo");
  await expect(lauraColumn.getByTestId("appointment-block")).toContainText(
    "Elena Gómez Díaz",
  );
});

test("una ausencia creada por el test aparece como time-off-block", async ({
  page,
}) => {
  const date = futureDate(43);
  const employee = await createThrowawayUser({
    fullName: "Profesional Cinco",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const { data, error } = await admin
    .from("employee_time_off")
    .insert({
      profile_id: employee.id,
      starts_at: `${date} 16:00:00 Europe/Madrid`,
      ends_at: `${date} 18:00:00 Europe/Madrid`,
      reason: "Formación e2e",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdTimeOffIds.push(data!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}`);

  const timeOffBlock = columnFor(page, employee.id).getByTestId(
    "time-off-block",
  );
  await expect(timeOffBlock).toBeVisible();
  await expect(timeOffBlock).toContainText("Formación e2e");
});

test("pulsar un hueco fuera de horario en la propia columna da de alta una cita, y pulsar la columna de un compañero no navega", async ({
  page,
}) => {
  const employeeId = await loginAsThrowawayEmployee(page, "Profesional Seis");

  const seeAlso = page.getByTestId("see-also");
  await seeAlso
    .getByTestId("see-also-option")
    .filter({ hasText: "Marc Ejemplo" })
    .getByRole("checkbox")
    .check();

  const marcColumn = columnFor(page, MARC_ID);
  await expect(marcColumn).toBeVisible();
  const beforeUrl = page.url();
  await marcColumn.click({ position: { x: 10, y: 130 } });
  await expect(page).toHaveURL(beforeUrl);

  const ownColumnBody = columnFor(page, employeeId).locator('[role="button"]');
  await ownColumnBody.click({ position: { x: 10, y: 130 } });

  await expect(page).toHaveURL(/\/appointments\/new\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const [, , minute] =
    url.searchParams.get("time")?.match(/^(\d{2}):(\d{2})$/) ?? [];
  expect(["00", "15", "30", "45"]).toContain(minute);
  expect(url.searchParams.get("professional")).toBe(employeeId);
});

test("cambiar a Semana muestra siete week-day, y una cita del test aparece en su día", async ({
  page,
}) => {
  const date = futureDate(50);
  const employee = await createThrowawayUser({
    fullName: "Profesional Semana Uno",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "11:00",
    endTime: "12:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&view=week`);

  await expect(visibleWeekDays(page)).toHaveCount(7);
  await expect(
    weekDayFor(page, date).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");
});

test("la semana del 25 de octubre de 2026 (cambio de hora) muestra del 19 al 25 y una cita de las 10:00 se ve a las 10:00", async ({
  page,
}) => {
  const employee = await createThrowawayUser({
    fullName: "Profesional Cambio De Hora",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date: "2026-10-25",
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=2026-10-25&view=week`);

  const weekDays = visibleWeekDays(page);
  await expect(weekDays).toHaveCount(7);
  const dates = await weekDays.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-date")),
  );
  expect(dates).toEqual([
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);

  await expect(
    weekDayFor(page, "2026-10-25").getByTestId("appointment-block"),
  ).toContainText("10:00");
});

test("la propietaria elige a Marc y ve su semana", async ({ page }) => {
  const date = futureDate(51);
  await createAppointment({
    professionalId: MARC_ID,
    patientId: ELENA_ID,
    serviceId: FISIOTERAPIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await loginAsThrowawayOwner(page, "Propietaria Semana");
  await page.goto(`${DASHBOARD}/?date=${date}&view=week`);

  await page
    .getByTestId("week-person")
    .filter({ hasText: "Marc Ejemplo" })
    .click();

  await expect(page).toHaveURL(new RegExp(`person=${MARC_ID}`));
  await expect(
    weekDayFor(page, date).getByTestId("appointment-block"),
  ).toContainText("Elena Gómez Díaz");
});

test("una cita a las 21:00, fuera del horario por defecto, se ve en Día y en Semana", async ({
  page,
}) => {
  const date = futureDate(52);
  const employee = await createThrowawayUser({
    fullName: "Profesional Fuera De Horario",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "21:00",
    endTime: "22:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);

  await page.goto(`${DASHBOARD}/?date=${date}&view=day`);
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");

  await page.goto(`${DASHBOARD}/?date=${date}&view=week`);
  await expect(
    weekDayFor(page, date).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");
});
