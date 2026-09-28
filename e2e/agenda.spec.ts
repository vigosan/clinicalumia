import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
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
const NORA_ID = "a0000000-0000-0000-0000-000000000603";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";
const FISIOTERAPIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005c1";

const createdAppointmentIds: string[] = [];
const createdTimeOffIds: string[] = [];
const createdUserIds: string[] = [];
const createdPersonIds: string[] = [];

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
  return addDays(todayInMadrid(), offsetDays);
}

function pastDate(daysAgo: number): string {
  return addDays(todayInMadrid(), -daysAgo);
}

function isoWeekday(date: string): number {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function dateWithWeekday(minOffsetDays: number, weekdays: number[]): string {
  let offset = minOffsetDays;
  while (!weekdays.includes(isoWeekday(futureDate(offset)))) {
    offset += 1;
  }
  return futureDate(offset);
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
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("id", createdAppointmentIds.splice(0));
    expect(error).toBeNull();
  }
  if (createdTimeOffIds.length > 0) {
    const { error } = await admin
      .from("employee_time_off")
      .delete()
      .in("id", createdTimeOffIds.splice(0));
    expect(error).toBeNull();
  }
  if (createdPersonIds.length > 0) {
    const { error } = await admin
      .from("people")
      .delete()
      .in("id", createdPersonIds.splice(0));
    expect(error).toBeNull();
  }
  const userIds = createdUserIds.splice(0);
  if (userIds.length > 0) {
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("professional_id", userIds);
    expect(error).toBeNull();
  }
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    expect(error).toBeNull();
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

test("la propietaria pasa de la semana de Marc a Día con with=Marc, y de un solo compañero en Día a Semana con person=ese compañero", async ({
  page,
}) => {
  await loginAsThrowawayOwner(page, "Propietaria Alterna");

  await page.goto(`${DASHBOARD}/?view=week&person=${MARC_ID}`);
  await expect(page.getByTestId("agenda-view-day")).toHaveAttribute(
    "href",
    new RegExp(`with=${MARC_ID}`),
  );

  await page.goto(`${DASHBOARD}/?view=day&with=${MARC_ID}`);
  await expect(page.getByTestId("agenda-view-week")).toHaveAttribute(
    "href",
    new RegExp(`person=${MARC_ID}`),
  );
});

test("una ausencia de varios días no invierte la rejilla y se ve en Día y en Semana", async ({
  page,
}) => {
  const startDate = futureDate(53);
  const middleDate = futureDate(54);
  const endDate = futureDate(56);

  const employee = await createThrowawayUser({
    fullName: "Profesional Ausencia Larga",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  const { data, error } = await admin
    .from("employee_time_off")
    .insert({
      profile_id: employee.id,
      starts_at: `${startDate} 18:00:00 Europe/Madrid`,
      ends_at: `${endDate} 09:00:00 Europe/Madrid`,
      reason: "Formación larga",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdTimeOffIds.push(data!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);

  await page.goto(`${DASHBOARD}/?date=${middleDate}&view=day`);
  await expect(
    columnFor(page, employee.id).getByTestId("time-off-block"),
  ).toBeVisible();

  await page.goto(`${DASHBOARD}/?date=${middleDate}&view=week`);
  await expect(
    weekDayFor(page, middleDate).getByTestId("time-off-block"),
  ).toBeVisible();
});

test("una ausencia de varios días no impide ver una cita normal ese mismo día", async ({
  page,
}) => {
  const startDate = futureDate(53);
  const middleDate = futureDate(54);
  const endDate = futureDate(56);

  const employee = await createThrowawayUser({
    fullName: "Profesional Ausencia Y Cita",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  const { data, error } = await admin
    .from("employee_time_off")
    .insert({
      profile_id: employee.id,
      starts_at: `${startDate} 18:00:00 Europe/Madrid`,
      ends_at: `${endDate} 09:00:00 Europe/Madrid`,
      reason: "Formación larga",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdTimeOffIds.push(data!.id);

  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date: middleDate,
    time: "11:00",
    endTime: "12:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);

  await page.goto(`${DASHBOARD}/?date=${middleDate}&view=day`);
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");

  await page.goto(`${DASHBOARD}/?date=${middleDate}&view=week`);
  await expect(
    weekDayFor(page, middleDate).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");
});

async function selectNora(page: Page) {
  await page.getByTestId("patient-search").fill("nora");
  await page.getByTestId("patient-option").filter({ hasText: "Nora" }).click();
  await expect(page.getByTestId("patient-selected")).toContainText("Nora");
}

function appointmentIdFrom(page: Page): string {
  const id = new URL(page.url()).searchParams.get("appointment");
  expect(id).toBeTruthy();
  return id ?? "";
}

test("desde un hueco de mañana, buscar «nora», elegir servicio y guardar crea la cita y aparece en la agenda", async ({
  page,
}) => {
  const date = dateWithWeekday(60, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Cita Mañana",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert({
      profile_id: employee.id,
      weekday: isoWeekday(date),
      starts_at: "09:00",
      ends_at: "14:00",
    });
  expect(scheduleError).toBeNull();

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:00&professional=${employee.id}`,
  );

  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(PSICOLOGIA_SERVICE_ID);
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/\/\?date=/);
  createdAppointmentIds.push(appointmentIdFrom(page));

  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("Nora");
});

test("«Nueva persona» desde el formulario de cita vuelve con la persona nueva elegida y conserva fecha, hora y profesional", async ({
  page,
}) => {
  const date = dateWithWeekday(61, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Nueva Persona",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=11:00&professional=${employee.id}`,
  );

  await page.getByRole("link", { name: "Nueva persona" }).click();
  await page.waitForURL(/\/patients\/new\?returnTo=/);

  const lastName = `PruebaVolver${Date.now()}`;
  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByTestId("person-submit").click();

  await page.waitForURL(/\/appointments\/new\?/);
  const url = new URL(page.url());
  expect(url.pathname).toBe("/appointments/new");
  expect(url.searchParams.get("date")).toBe(date);
  expect(url.searchParams.get("time")).toBe("11:00");
  expect(url.searchParams.get("professional")).toBe(employee.id);
  const newPatientId = url.searchParams.get("patient");
  expect(newPatientId).toBeTruthy();
  createdPersonIds.push(newPatientId ?? "");

  await expect(page.getByTestId("patient-selected")).toContainText(
    `Persona ${lastName}`,
  );
});

test("una cita a las 16:55 se guarda tocando el límite de otra de 16:10 a 16:55", async ({
  page,
}) => {
  const date = dateWithWeekday(61, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Límite",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "15:00",
    ends_at: "21:00",
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:10",
    endTime: "16:55",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=16:55&professional=${employee.id}`,
  );
  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(PSICOLOGIA_SERVICE_ID);
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/\/\?date=/);
  createdAppointmentIds.push(appointmentIdFrom(page));
});

test("una cita a las 16:50 contra una de 16:10 a 16:55 da el error de solape y conserva lo escrito", async ({
  page,
}) => {
  const date = dateWithWeekday(62, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Solape",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "15:00",
    ends_at: "21:00",
  });
  await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:10",
    endTime: "16:55",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=16:50&professional=${employee.id}`,
  );
  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(PSICOLOGIA_SERVICE_ID);
  await page.getByTestId("appointment-notes").fill("Nota de prueba de solape");
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("appointment-error")).toContainText(
    "Profesional Solape ya tiene una cita de 16:10 a 16:55.",
  );
  await expect(page.getByTestId("patient-selected")).toContainText("Nora");
  await expect(page.getByTestId("appointment-notes")).toHaveValue(
    "Nota de prueba de solape",
  );
});

test("un sábado da el aviso «Queda fuera del horario» y, tras «Dar la cita igualmente», se guarda", async ({
  page,
}) => {
  const date = dateWithWeekday(60, [6]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Sábado",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=11:00&professional=${employee.id}`,
  );
  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(PSICOLOGIA_SERVICE_ID);
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("appointment-warnings")).toContainText(
    "Queda fuera del horario",
  );
  await expect(page).toHaveURL(/\/appointments\/new\?/);

  await page.getByTestId("appointment-confirm").click();

  await page.waitForURL(/\/\?date=/);
  createdAppointmentIds.push(appointmentIdFrom(page));
});

test("hacer doble clic en Guardar crea una sola cita", async ({ page }) => {
  const date = dateWithWeekday(63, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Doble Clic",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "09:00",
    ends_at: "14:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:00&professional=${employee.id}`,
  );
  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(PSICOLOGIA_SERVICE_ID);
  await page.getByTestId("appointment-submit").dblclick();

  await page.waitForURL(/\/\?date=/);
  createdAppointmentIds.push(appointmentIdFrom(page));

  const { data, error } = await admin
    .from("appointments")
    .select("id")
    .eq("professional_id", employee.id)
    .eq("patient_id", NORA_ID)
    .neq("status", "cancelled");
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
});

test("la propietaria elige profesional y ve los servicios de su especialidad", async ({
  page,
}) => {
  const date = dateWithWeekday(90, [1, 2, 3, 4, 5]);
  await loginAsThrowawayOwner(page, "Propietaria Cita");
  await page.goto(`${DASHBOARD}/appointments/new?date=${date}&time=16:00`);

  await page.getByTestId("appointment-professional").selectOption(MARC_ID);
  await expect(page.getByTestId("appointment-service")).toContainText(
    "Sesión individual de fisioterapia",
  );

  await selectNora(page);
  await page
    .getByTestId("appointment-service")
    .selectOption(FISIOTERAPIA_SERVICE_ID);
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/\/\?date=/);
  createdAppointmentIds.push(appointmentIdFrom(page));
});

test("abrir una cita del test, moverla a otra hora, la agenda la muestra en su sitio y el historial dice «Movida de…»", async ({
  page,
}) => {
  const date = dateWithWeekday(100, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Mover Panel",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "09:00",
    ends_at: "20:00",
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await page.getByTestId("appointment-move-time").fill("14:00");
  await page.getByTestId("appointment-move").click();

  await page.waitForURL(new RegExp(`appointment=${appointmentId}`));
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("14:00");
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Movida de",
  );
});

test("mover una cita a otro día hace que el historial muestre la fecha en «Movida de…», no solo la hora", async ({
  page,
}) => {
  const date = dateWithWeekday(104, [1, 2, 3]);
  const nextDate = dateWithWeekday(105, [4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Mover Otro Día",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert([
    {
      profile_id: employee.id,
      weekday: isoWeekday(date),
      starts_at: "09:00",
      ends_at: "20:00",
    },
    {
      profile_id: employee.id,
      weekday: isoWeekday(nextDate),
      starts_at: "09:00",
      ends_at: "20:00",
    },
  ]);
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await page.getByTestId("appointment-move-date").fill(nextDate);
  await page.getByTestId("appointment-move-time").fill("16:00");
  await page.getByTestId("appointment-move").click();

  await page.waitForURL(new RegExp(`appointment=${appointmentId}`));
  const [fromDay, fromMonth] = date.split("-").slice(1).reverse();
  const [toDay, toMonth] = nextDate.split("-").slice(1).reverse();
  await expect(page.getByTestId("appointment-history")).toContainText(
    `Movida de ${fromDay}/${fromMonth} 16:00 a ${toDay}/${toMonth} 16:00`,
  );
});

test("mover una cita de duración personalizada conserva esa duración, y cambiarla en el formulario de mover funciona", async ({
  page,
}) => {
  const date = dateWithWeekday(103, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Duración Personalizada",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "09:00",
    ends_at: "20:00",
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:30",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await expect(page.getByTestId("appointment-move-duration")).toHaveValue("90");

  await page.getByTestId("appointment-move-time").fill("14:00");
  await page.getByTestId("appointment-move").click();
  await page.waitForURL(new RegExp(`appointment=${appointmentId}`));

  const afterMove = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", appointmentId)
    .single();
  expect(afterMove.error).toBeNull();
  const movedMinutes =
    (new Date(afterMove.data!.ends_at).getTime() -
      new Date(afterMove.data!.starts_at).getTime()) /
    60_000;
  expect(movedMinutes).toBe(90);

  await page.getByTestId("appointment-move-time").fill("16:00");
  await page.getByTestId("appointment-move-duration").fill("30");
  await page.getByTestId("appointment-move").click();
  await page.waitForURL(new RegExp(`appointment=${appointmentId}`));

  const afterDurationChange = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", appointmentId)
    .single();
  expect(afterDurationChange.error).toBeNull();
  const finalMinutes =
    (new Date(afterDurationChange.data!.ends_at).getTime() -
      new Date(afterDurationChange.data!.starts_at).getTime()) /
    60_000;
  expect(finalMinutes).toBe(30);
});

test("cancelar como «paciente» con motivo la quita de la agenda y el historial dice «Cancelada (paciente) por»", async ({
  page,
}) => {
  const date = dateWithWeekday(101, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Cancelar Panel",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await page.getByTestId("appointment-cancel").click();
  await page.getByTestId("cancel-by").selectOption("patient");
  await page.getByTestId("cancel-reason").fill("Se encontraba mal");
  await page.getByTestId("cancel-confirm").click();

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Cancelada (paciente) por",
  );
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toHaveCount(0);
});

test("en una cita pasada, «No se presentó» la atenúa y «Deshacer» la devuelve", async ({
  page,
}) => {
  const date = pastDate(120);
  const employee = await createThrowawayUser({
    fullName: "Profesional No Presentado Panel",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await page.getByTestId("appointment-no-show").click();
  await page.getByTestId("confirm-action").click();

  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toHaveClass(/opacity-60/);
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Marcada como no presentada",
  );

  await page.getByTestId("appointment-restore").click();

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Restaurada",
  );
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).not.toHaveClass(/opacity-60/);
});

test("en una cita futura no aparece «No se presentó»", async ({ page }) => {
  const date = futureDate(112);
  const employee = await createThrowawayUser({
    fullName: "Profesional Futura Panel",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await expect(page.getByTestId("appointment-no-show")).toHaveCount(0);
});

test("hacer doble clic en confirmar cancelación crea un solo evento", async ({
  page,
}) => {
  const date = dateWithWeekday(102, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Doble Clic Cancelar",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await page.getByTestId("appointment-cancel").click();
  await page.getByTestId("cancel-by").selectOption("clinic");
  await page.getByTestId("cancel-confirm").dblclick();

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Cancelada (clínica) por",
  );

  const { data, error } = await admin
    .from("appointment_events")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("kind", "cancelled");
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
});

test("un empleado no ve el panel de una cita de otro profesional", async ({
  page,
}) => {
  const date = futureDate(113);
  const appointmentId = await createAppointment({
    professionalId: MARC_ID,
    patientId: ELENA_ID,
    serviceId: FISIOTERAPIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  await loginAsThrowawayEmployee(page, "Profesional Sin Acceso Panel");
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await expect(page.getByTestId("appointment-panel")).toHaveCount(0);
});

test("una cita de Nora aparece en «Próximas» en su ficha para la empleada que la dio, no para otra empleada, y sí para la propietaria", async ({
  browser,
}) => {
  const date = futureDate(130);
  const employeeA = await createThrowawayUser({
    fullName: "Empleada Ficha Una",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const employeeB = await createThrowawayUser({
    fullName: "Empleada Ficha Dos",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const owner = await createThrowawayUser({
    fullName: "Propietaria Ficha",
    role: "owner",
  });
  const appointmentId = await createAppointment({
    professionalId: employeeA.id,
    patientId: NORA_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextOwner = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageOwner = await contextOwner.newPage();

    await signIn(pageA, DASHBOARD, employeeA.email, employeeA.password);
    await pageA.goto(`${DASHBOARD}/patients/${NORA_ID}`);
    const ownRow = pageA.getByTestId("patient-appointment");
    await expect(ownRow).toHaveCount(1);
    await expect(ownRow).toHaveAttribute(
      "href",
      `/?date=${date}&appointment=${appointmentId}`,
    );

    await signIn(pageB, DASHBOARD, employeeB.email, employeeB.password);
    await pageB.goto(`${DASHBOARD}/patients/${NORA_ID}`);
    await expect(pageB.getByTestId("patient-appointment")).toHaveCount(0);

    await signIn(pageOwner, DASHBOARD, owner.email, owner.password);
    await pageOwner.goto(`${DASHBOARD}/patients/${NORA_ID}`);
    await expect(
      pageOwner.locator(
        `[data-testid="patient-appointment"][href="/?date=${date}&appointment=${appointmentId}"]`,
      ),
    ).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
    await contextOwner.close();
  }
});
