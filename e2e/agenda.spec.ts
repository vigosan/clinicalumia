import { execSync } from "node:child_process";
import {
  addDays,
  madridDateTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { pickDate, pickTime } from "./date-time";
import { selectOption } from "./select";
import { recordServerRenders, slowDownServerActions } from "./server-renders";

const DASHBOARD = "http://localhost:3001";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const anonKey = env.match(/^ANON_KEY="?([^"\n]+)/m)?.[1];
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
const createdServiceIds: string[] = [];
const createdSpecialtyIds: string[] = [];

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

test('activar a Marc en "Ver también la agenda de" muestra su columna con un busy-block sin el nombre del paciente', async ({
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

test("una ausencia aparece como «Ausencia» sin motivo para la empleada y con el motivo para la propietaria", async ({
  page,
  browser,
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
      starts_at: `${date} 10:00:00 Europe/Madrid`,
      ends_at: `${date} 12:00:00 Europe/Madrid`,
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
  await expect(timeOffBlock).toContainText("Ausencia");
  await expect(timeOffBlock).toContainText("10:00 – 12:00");
  await expect(timeOffBlock).not.toContainText("Formación e2e");

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await loginAsThrowawayOwner(ownerPage, "Propietaria de prueba");
  await ownerPage.goto(`${DASHBOARD}/?date=${date}`);
  await expect(
    columnFor(ownerPage, employee.id).getByTestId("time-off-block"),
  ).toContainText("Formación e2e");
  await ownerContext.close();
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

  await expect(page).toHaveURL(/[?&]new=1/);
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

test("una ausencia fuera del horario de todos se ve en la agenda del día y de la semana", async ({
  page,
}) => {
  const date = dateWithWeekday(57, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Ausencia Tarde",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  await admin.from("employee_schedules").insert({
    profile_id: employee.id,
    weekday: isoWeekday(date),
    starts_at: "09:00",
    ends_at: "14:00",
  });
  const { data, error } = await admin
    .from("employee_time_off")
    .insert({
      profile_id: employee.id,
      starts_at: `${date} 19:00:00 Europe/Madrid`,
      ends_at: `${date} 21:00:00 Europe/Madrid`,
      reason: "Tutoría de tarde",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdTimeOffIds.push(data!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);

  await page.goto(`${DASHBOARD}/?date=${date}&view=day`);
  await expect(
    columnFor(page, employee.id).getByTestId("time-off-block"),
  ).toContainText("19:00 – 21:00");

  await page.goto(`${DASHBOARD}/?date=${date}&view=week`);
  await expect(
    weekDayFor(page, date).getByTestId("time-off-block"),
  ).toBeVisible();
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
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/[?&]appointment=/);
  createdAppointmentIds.push(appointmentIdFrom(page));

  await expect(page.getByTestId("toast")).toHaveText("Cita creada");
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("Nora");
});

test("en Nueva cita el buscador muestra edad y teléfono de cada paciente y se usa solo con el teclado: Enter elige y la cita se guarda con ese paciente", async ({
  page,
}) => {
  const date = dateWithWeekday(62, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Buscador",
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
  const lastName = `Teclado${Date.now()}`;
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      is_patient: true,
      birth_date: "1990-01-01",
      phone: "+34611222333",
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:00&professional=${employee.id}`,
  );

  const search = page.getByTestId("patient-search");
  await expect(search).toHaveAttribute("role", "combobox");
  await search.fill(lastName);
  const option = page.getByTestId("patient-option");
  await expect(option).toHaveCount(1);
  await expect(option).toContainText(`Paciente ${lastName}`);
  await expect(option).toContainText(/\d+ años/);
  await expect(option).toContainText("611222333");

  await search.press("Enter");
  await expect(page.getByTestId("patient-selected")).toContainText(
    `Paciente ${lastName}`,
  );
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/[?&]appointment=/);
  const appointmentId = appointmentIdFrom(page);
  createdAppointmentIds.push(appointmentId);
  const { data: saved } = await admin
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .single();
  expect(saved?.patient_id).toBe(person!.id);
});

test("en Nueva cita, Enter sin resultados no abre «Nuevo paciente» ni pierde lo escrito, y Escape cierra la lista dejando el foco en el buscador", async ({
  page,
}) => {
  const employee = await createThrowawayUser({
    fullName: "Profesional Escape",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${dateWithWeekday(63, [1, 2, 3, 4, 5])}&time=10:00&professional=${employee.id}`,
  );

  await page.getByTestId("appointment-notes").fill("Nota a conservar");
  const url = page.url();
  const search = page.getByTestId("patient-search");
  await search.focus();
  await expect(
    page.getByRole("option", { name: "Nuevo paciente" }),
  ).toBeVisible();
  await search.press("Enter");
  await search.fill("zzz-no-existe-zzz");
  await expect(page.getByTestId("patient-search-empty")).toHaveText(
    "No hay pacientes con esos datos.",
  );
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("Enter");
  await expect(page.getByTestId("patient-search-empty")).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("appointment-notes")).toHaveValue(
    "Nota a conservar",
  );

  await search.press("Escape");
  await expect(page.getByTestId("patient-search-empty")).toBeHidden();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(search).toBeFocused();
  await expect(page.getByTestId("patient-selected")).toHaveCount(0);
});

test("«Nuevo paciente» desde el formulario de cita vuelve con el paciente nuevo elegido y conserva fecha, hora y profesional", async ({
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

  await page.getByTestId("patient-search").click();
  await page.getByRole("option", { name: "Nuevo paciente" }).click();
  await page.waitForURL(/\/patients\/new\?returnTo=/);

  const lastName = `PruebaVolver${Date.now()}`;
  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  await page.getByTestId("person-submit").click();

  await page.waitForURL((target) => target.searchParams.get("new") === "1");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/");
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

test("«Cancelar» en Nueva cita vuelve al día de la agenda del que se venía, no a hoy", async ({
  page,
}) => {
  const date = dateWithWeekday(61, [1, 2, 3, 4, 5]);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/appointments/new?date=${date}`);
  await page
    .getByTestId("new-appointment-drawer")
    .getByRole("button", { name: "Cancelar" })
    .click();

  await expect(page).toHaveURL(`${DASHBOARD}/?date=${date}`);
  await expect(page.getByTestId("new-appointment-drawer")).toHaveCount(0);
});

test("«Nueva cita» se abre en un panel encima de la agenda, para dar la cita sin perder de vista el día, y abre y cierra sin esperar al servidor", async ({
  page,
}) => {
  const date = dateWithWeekday(61, [1, 2, 3, 4, 5]);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/?date=${date}`);
  const serverRenders = recordServerRenders(page);
  await page.getByTestId("agenda-new").click();

  const drawer = page.getByTestId("new-appointment-drawer");
  await expect(drawer.getByTestId("appointment-form")).toBeVisible();
  await expect(page.getByTestId("agenda-title")).toBeAttached();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/");
  expect(url.searchParams.get("date")).toBe(date);
  expect(url.searchParams.get("new")).toBe("1");

  await drawer.getByRole("button", { name: "Cerrar" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).not.toHaveURL(/new=1/);
  expect(serverRenders).toEqual([]);
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
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/[?&]appointment=/);
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
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
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

async function patientBookedWithAnotherProfessional(date: string) {
  const other = await createThrowawayUser({
    fullName: "Profesional Otra Cita",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const employee = await createThrowawayUser({
    fullName: "Profesional Mismo Paciente",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [other.id, employee.id].map((profileId) => ({
        profile_id: profileId,
        weekday: isoWeekday(date),
        starts_at: "09:00",
        ends_at: "20:00",
      })),
    );
  expect(scheduleError).toBeNull();
  const lastName = `Solape${Date.now()}`;
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      is_patient: true,
      birth_date: "1990-01-01",
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);
  await createAppointment({
    professionalId: other.id,
    patientId: person!.id,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });
  return { employee, patientId: person!.id as string, lastName };
}

test("dar una cita a un paciente que ya tiene otra a esa hora con otra profesional lo explica y conserva lo escrito", async ({
  page,
}) => {
  const date = dateWithWeekday(64, [1, 2, 3, 4, 5]);
  const { employee, lastName } =
    await patientBookedWithAnotherProfessional(date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:30&professional=${employee.id}`,
  );
  await page.getByTestId("patient-search").fill(lastName);
  await page
    .getByTestId("patient-option")
    .filter({ hasText: lastName })
    .click();
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-notes").fill("Nota del doble horario");
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("appointment-error")).toHaveText(
    "Este paciente ya tiene una cita a esa hora.",
  );
  await expect(page.getByTestId("patient-selected")).toContainText(lastName);
  await expect(page.getByTestId("appointment-notes")).toHaveValue(
    "Nota del doble horario",
  );
});

test("mover una cita encima de otra del mismo paciente con otra profesional lo explica y no la mueve", async ({
  page,
}) => {
  const date = dateWithWeekday(65, [1, 2, 3, 4, 5]);
  const { employee, patientId } =
    await patientBookedWithAnotherProfessional(date);
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "12:00",
    endTime: "13:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await pickTime(page.getByTestId("appointment-move-time"), "10:30");
  await page.getByTestId("appointment-move").click();

  await expect(page.getByTestId("appointment-action-error")).toHaveText(
    "Este paciente ya tiene una cita a esa hora.",
  );
  const { data: unchanged } = await admin
    .from("appointments")
    .select("starts_at")
    .eq("id", appointmentId)
    .single();
  expect(madridDateTime(unchanged!.starts_at).time.slice(0, 5)).toBe("12:00");
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
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("appointment-warnings")).toContainText(
    "Queda fuera del horario",
  );
  await expect(page).toHaveURL(/[?&]new=1/);

  await page.getByTestId("appointment-confirm").click();

  await page.waitForURL(/[?&]appointment=/);
  createdAppointmentIds.push(appointmentIdFrom(page));
});

test("dar una cita a una hora que ya ha pasado pide confirmación y, tras «Dar la cita igualmente», se guarda", async ({
  page,
}) => {
  const date = pastDate(130 + Math.floor(Math.random() * 30));
  const employee = await createThrowawayUser({
    fullName: "Profesional Hora Pasada",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=11:00&professional=${employee.id}`,
  );
  await selectNora(page);
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("appointment-warnings")).toContainText(
    "Esa hora ya ha pasado.",
  );
  await expect(page).toHaveURL(/[?&]new=1/);

  await page.getByTestId("appointment-confirm").click();

  await page.waitForURL(/[?&]appointment=/);
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
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").dblclick();

  await page.waitForURL(/[?&]appointment=/);
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

test("Nueva cita no ofrece a quien aún no ha aceptado la invitación, ni en la agenda ni desde la ficha", async ({
  page,
}) => {
  const date = dateWithWeekday(91, [1, 2, 3, 4, 5]);
  const invitedEmail = `agenda-invitada-${Date.now()}@test.local`;
  const { data, error } =
    await admin.auth.admin.inviteUserByEmail(invitedEmail);
  expect(error).toBeNull();
  const invitedId = data.user!.id;
  createdUserIds.push(invitedId);
  const { error: profileError } = await admin.from("profiles").insert({
    id: invitedId,
    email: invitedEmail,
    full_name: "Irene Invitada",
    role: "employee",
    specialty_id: PSICOLOGIA_SPECIALTY_ID,
    is_active: true,
  });
  expect(profileError).toBeNull();

  await loginAsThrowawayOwner(page, "Propietaria Invitaciones");
  const listbox = page.getByRole("listbox");

  await page.goto(`${DASHBOARD}/?date=${date}&new=1`);
  await page.getByTestId("appointment-professional").click();
  await expect(listbox.getByTestId(`option-${MARC_ID}`)).toBeVisible();
  await expect(listbox.getByTestId(`option-${invitedId}`)).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto(
    `${DASHBOARD}/appointments/new?patient=${NORA_ID}&professional=${invitedId}`,
  );
  await page.getByTestId("appointment-professional").click();
  await expect(listbox.getByTestId(`option-${MARC_ID}`)).toBeVisible();
  await expect(listbox.getByTestId(`option-${invitedId}`)).toHaveCount(0);
  await page.keyboard.press("Escape");

  const { error: passwordError } = await admin.auth.admin.updateUserById(
    invitedId,
    { password: "lumia-segura-2026" },
  );
  expect(passwordError).toBeNull();

  await page.goto(`${DASHBOARD}/appointments/new?patient=${NORA_ID}`);
  await page.getByTestId("appointment-professional").click();
  await expect(listbox.getByTestId(`option-${invitedId}`)).toBeVisible();
});

test("la propietaria elige profesional y ve los servicios de su especialidad", async ({
  page,
}) => {
  const date = dateWithWeekday(90, [1, 2, 3, 4, 5]);
  await loginAsThrowawayOwner(page, "Propietaria Cita");
  await page.goto(`${DASHBOARD}/appointments/new?date=${date}&time=16:00`);

  await selectOption(page.getByTestId("appointment-professional"), MARC_ID);
  await page.getByTestId("appointment-service").click();
  await expect(
    page.getByRole("option", { name: "Sesión individual de fisioterapia" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("appointment-service")).toBeFocused();

  await selectNora(page);
  await selectOption(
    page.getByTestId("appointment-service"),
    FISIOTERAPIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();

  await page.waitForURL(/[?&]appointment=/);
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
  await pickTime(page.getByTestId("appointment-move-time"), "14:00");
  await page.getByTestId("appointment-move").click();

  await page.waitForURL(new RegExp(`appointment=${appointmentId}`));
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toContainText("14:00");
  await expect(page.getByTestId("toast")).toHaveText("Cita cambiada");
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Movida de",
  );
});

test("la propietaria ve la columna de una profesional desactivada con citas ese día y le pasa la cita a otra profesional desde «Cambiar fecha u hora»", async ({
  page,
}) => {
  const date = dateWithWeekday(110, [1, 2, 3, 4, 5]);
  const leaving = await createThrowawayUser({
    fullName: `Saliente ${Date.now()}`,
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const colleague = await createThrowawayUser({
    fullName: `Relevo ${Date.now()}`,
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const appointmentId = await createAppointment({
    professionalId: leaving.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "12:00",
    endTime: "13:00",
  });
  const { error: deactivateError } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", leaving.id);
  expect(deactivateError).toBeNull();

  await loginAsThrowawayOwner(page, "Propietaria Relevo");
  await page.goto(`${DASHBOARD}/?date=${date}&view=week`);
  const leavingWeek = page.locator(
    `[data-testid="week-person"][data-person="${leaving.id}"]`,
  );
  await expect(leavingWeek).toContainText("(inactiva)");
  await leavingWeek.click();
  await expect(
    weekDayFor(page, date).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");

  await page.goto(`${DASHBOARD}/?date=${date}`);

  const leavingColumn = columnFor(page, leaving.id);
  await expect(
    leavingColumn.getByTestId("agenda-column-inactive"),
  ).toBeVisible();
  await leavingColumn.getByTestId("appointment-block").click();
  await expect(page.getByTestId("appointment-panel")).toBeVisible();

  await selectOption(
    page.getByTestId("appointment-move-professional"),
    colleague.id,
  );
  await page.getByTestId("appointment-move").click();
  await expect(page.getByTestId("appointment-warnings")).toContainText(
    "Queda fuera del horario de Relevo",
  );
  await page.getByTestId("appointment-confirm").click();

  await expect(
    columnFor(page, colleague.id).getByTestId("appointment-block"),
  ).toContainText("Jorge Ruiz Pérez");
  await expect(columnFor(page, leaving.id)).toHaveCount(0);
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Reasignada de Saliente",
  );
  await expect(page.getByTestId("appointment-history")).toContainText(
    "a Relevo",
  );
  const { data: stored } = await admin
    .from("appointments")
    .select("professional_id, starts_at")
    .eq("id", appointmentId)
    .single();
  expect(stored?.professional_id).toBe(colleague.id);
  expect(madridDateTime(stored!.starts_at)).toEqual({
    date,
    time: "12:00",
  });
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

  await pickDate(page.getByTestId("appointment-move-date"), nextDate);
  await pickTime(page.getByTestId("appointment-move-time"), "16:00");
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

  await expect(page.getByTestId("appointment-move-duration")).toHaveText(
    "1 h 30 min",
  );
  await expect(page.getByTestId("appointment-panel")).toContainText(
    "Psicoterapia individual · 1 h 30 min",
  );

  await pickTime(page.getByTestId("appointment-move-time"), "14:00");
  await page.getByTestId("appointment-move").click();
  await expect(page.getByTestId("appointment-panel-date")).toContainText(
    "14:00",
  );

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

  await pickTime(page.getByTestId("appointment-move-time"), "16:00");
  await selectOption(page.getByTestId("appointment-move-duration"), "other");
  await page.getByTestId("appointment-move-duration-minutes").fill("50");
  await page.getByTestId("appointment-move").click();
  await expect(page.getByTestId("appointment-panel-date")).toContainText(
    "16:00",
  );

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
  expect(finalMinutes).toBe(50);
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
  await page.getByTestId("cancel-by-patient").check();
  await page.getByTestId("cancel-reason").fill("Se encontraba mal");
  await page.getByTestId("cancel-confirm").click();

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Cancelada (paciente) por",
  );
  await expect(page.getByTestId("toast")).toHaveText("Cita cancelada");
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toHaveCount(0);
});

test("en el panel de la cita, «Siguiente» y «Anterior» pasan a las otras citas de la agenda en orden sin cerrar el panel, y conservan la vista", async ({
  page,
}) => {
  const date = dateWithWeekday(106, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Panel Siguiente",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const first = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "09:00",
    endTime: "10:00",
  });
  const third = await createAppointment({
    professionalId: employee.id,
    patientId: NORA_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "16:00",
    endTime: "17:00",
  });
  const second = await createAppointment({
    professionalId: employee.id,
    patientId: ELENA_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "12:00",
    endTime: "13:00",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${second}`);
  const panel = page.getByTestId("appointment-panel");
  await expect(panel).toContainText("Elena");
  const serverRenders = recordServerRenders(page);

  await panel.getByTestId("appointment-next").click();
  await expect(page).toHaveURL(new RegExp(`appointment=${third}`));
  await expect(panel).toContainText("Nora");
  await expect(panel.getByTestId("appointment-history")).toBeVisible();
  await expect(panel.getByTestId("appointment-next")).toHaveCount(0);

  await panel.getByTestId("appointment-previous").click();
  await expect(page).toHaveURL(new RegExp(`appointment=${second}`));
  await expect(panel).toContainText("Elena");
  await panel.getByTestId("appointment-previous").click();
  await expect(page).toHaveURL(new RegExp(`appointment=${first}`));
  await expect(panel).toContainText("Jorge");
  await expect(panel.getByTestId("appointment-previous")).toHaveCount(0);
  expect(serverRenders).toEqual([]);

  await page.goto(`${DASHBOARD}/?date=${date}&view=week&appointment=${first}`);
  await expect(panel).toContainText("Jorge");
  await panel.getByTestId("appointment-next").click();
  await expect(page).toHaveURL(new RegExp(`appointment=${second}`));
  await expect(page).toHaveURL(/view=week/);
  await expect(panel).toContainText("Elena");
});

test("el panel de la cita retiene el foco mientras está abierto, y Escape lo cierra sin recargar la agenda y devuelve el foco a la cita", async ({
  page,
}) => {
  const date = dateWithWeekday(104, [1, 2, 3, 4, 5]);
  const employee = await createThrowawayUser({
    fullName: "Profesional Panel Teclado",
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
  await page.goto(`${DASHBOARD}/?date=${date}`);
  const serverRenders = recordServerRenders(page);
  const block = columnFor(page, employee.id).locator(
    `[data-appointment="${appointmentId}"]`,
  );
  await block.click();

  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAttribute("data-testid", "appointment-panel");
  await expect(panel).toContainText("Jorge");
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press("Tab");
    expect(
      await panel.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("appointment-panel")).toHaveCount(0);
  await expect(page).not.toHaveURL(/appointment=/);
  await expect(block).toBeFocused();
  expect(serverRenders).toEqual([]);
});

test("en una cita pasada, «Marcar como no presentada» la atenúa y «Deshacer «no presentada»» la devuelve, y el panel lo refleja sin esperar al servidor", async ({
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

  await expect(page.getByTestId("appointment-status")).toHaveText("Realizada");
  await slowDownServerActions(page, 3000);
  await page.getByTestId("appointment-no-show").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("appointment-status")).toHaveText(
    "No presentada",
    { timeout: 1000 },
  );

  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).toHaveClass(/opacity-60/);
  await expect(page.getByTestId("appointment-status")).toHaveText(
    "No presentada",
  );
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Marcada como no presentada",
  );

  await page.getByTestId("appointment-restore").click();
  await expect(page.getByTestId("appointment-status")).toHaveText("Realizada", {
    timeout: 1000,
  });

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Se deshizo «no presentada»",
  );
  await expect(
    columnFor(page, employee.id).getByTestId("appointment-block"),
  ).not.toHaveClass(/opacity-60/);
});

test("una no presentada libera su franja: se da a otro paciente, las dos se ven, y deshacerla avisa de que la franja está ocupada", async ({
  page,
}) => {
  const date = pastDate(150 + Math.floor(Math.random() * 30));
  const employee = await createThrowawayUser({
    fullName: "Profesional Franja Liberada",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });
  const noShowId = await createAppointment({
    professionalId: employee.id,
    patientId: JORGE_ID,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });
  const { error } = await admin
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", noShowId);
  expect(error).toBeNull();

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(
    `${DASHBOARD}/appointments/new?date=${date}&time=10:00&professional=${employee.id}`,
  );
  await selectNora(page);
  await selectOption(
    page.getByTestId("appointment-service"),
    PSICOLOGIA_SERVICE_ID,
  );
  await page.getByTestId("appointment-submit").click();
  await page.getByTestId("appointment-confirm").click();
  await page.waitForURL(/[?&]appointment=/);
  const takenId = appointmentIdFrom(page);
  createdAppointmentIds.push(takenId);

  const column = columnFor(page, employee.id);
  await expect(column.getByTestId("appointment-block")).toHaveCount(2);
  const noShowBlock = column.locator(
    `[data-testid="appointment-block"][data-appointment="${noShowId}"]`,
  );
  const takenBlock = column.locator(
    `[data-testid="appointment-block"][data-appointment="${takenId}"]`,
  );
  await expect(noShowBlock).toHaveClass(/opacity-60/);
  await expect(noShowBlock).toContainText("Jorge");
  await expect(takenBlock).toContainText("Nora");
  const noShowBox = await noShowBlock.boundingBox();
  const takenBox = await takenBlock.boundingBox();
  expect(takenBox!.x + takenBox!.width).toBeLessThanOrEqual(noShowBox!.x);

  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${noShowId}`);
  await page.getByTestId("appointment-restore").click();
  await expect(page.getByTestId("appointment-action-error")).toHaveText(
    "Esa franja ya está ocupada por otra cita.",
  );
  await expect(page.getByTestId("appointment-status")).toHaveText(
    "No presentada",
  );
});

test("en una cita futura no aparece «Marcar como no presentada»", async ({
  page,
}) => {
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
  await page.getByTestId("cancel-by-clinic").check();
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

test("una cita reservada desde la web muestra «Reserva web» en el bloque y en el panel, y el historial dice que se reservó desde la web", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: specialty, error: specialtyError } = await admin
    .from("specialties")
    .insert({
      name: `Agenda web e2e ${suffix}`,
      slug: `agenda-web-e2e-${suffix}`,
    })
    .select("id")
    .single();
  expect(specialtyError).toBeNull();
  createdSpecialtyIds.push(specialty!.id);

  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      specialty_id: specialty!.id,
      name: `Servicio web e2e ${suffix}`,
      duration_minutes: 45,
      price_cents: 4000,
      bookable_online: true,
      booking_payment: "none",
    })
    .select("id")
    .single();
  expect(serviceError).toBeNull();
  createdServiceIds.push(service!.id);

  const employee = await createThrowawayUser({
    fullName: "Profesional Reserva Web",
    role: "employee",
    specialtyId: specialty!.id,
  });
  const { error: scheduleError } = await admin
    .from("employee_schedules")
    .insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        profile_id: employee.id,
        weekday,
        starts_at: "09:00",
        ends_at: "20:00",
      })),
    );
  expect(scheduleError).toBeNull();

  const patientEmail = `agenda-web-paciente-${suffix}@test.local`;
  const patientPassword = "lumia-segura-2026";
  const { data: patientUser, error: patientUserError } =
    await admin.auth.admin.createUser({
      email: patientEmail,
      password: patientPassword,
      email_confirm: true,
    });
  expect(patientUserError).toBeNull();
  createdUserIds.push(patientUser!.user!.id);
  const { error: patientAccountError } = await admin
    .from("patient_accounts")
    .insert({ id: patientUser!.user!.id, email: patientEmail });
  expect(patientAccountError).toBeNull();

  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: "Web",
      email: patientEmail,
      is_patient: true,
      birth_date: "1990-01-01",
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);

  const patientClient = createClient("http://127.0.0.1:54321", anonKey ?? "");
  const { error: signInError } = await patientClient.auth.signInWithPassword({
    email: patientEmail,
    password: patientPassword,
  });
  expect(signInError).toBeNull();

  const { data: slots, error: slotsError } = await patientClient.rpc(
    "available_slots",
    {
      p_service_id: service!.id,
      p_professional_id: employee.id,
      p_from: futureDate(2),
      p_to: futureDate(6),
    },
  );
  expect(slotsError).toBeNull();
  const chosen = slots?.[0];
  expect(chosen).toBeTruthy();

  const { data: appointmentId, error: bookError } = await patientClient.rpc(
    "book_appointment",
    {
      p_person_id: person!.id,
      p_service_id: service!.id,
      p_professional_id: employee.id,
      p_starts_at: chosen!.starts_at,
    },
  );
  expect(bookError).toBeNull();
  createdAppointmentIds.push(appointmentId as unknown as string);

  const date = madridDateTime(chosen!.starts_at).date;
  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}`);

  const appointmentBlock = columnFor(page, employee.id).getByTestId(
    "appointment-block",
  );
  await expect(appointmentBlock.getByTestId("web-booking-badge")).toBeVisible();

  await appointmentBlock.click();
  await expect(
    page.getByTestId("appointment-panel").getByTestId("web-booking-badge"),
  ).toBeVisible();
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Reservada desde la web el",
  );
});

test("cancelar desde su sesión una cita que le reservó el equipo hace que el historial de la profesional diga que se canceló desde la web", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const employee = await createThrowawayUser({
    fullName: "Profesional Cancelada Web",
    role: "employee",
    specialtyId: PSICOLOGIA_SPECIALTY_ID,
  });

  const patientEmail = `agenda-cancelada-web-paciente-${suffix}@test.local`;
  const patientPassword = "lumia-segura-2026";
  const { data: patientUser, error: patientUserError } =
    await admin.auth.admin.createUser({
      email: patientEmail,
      password: patientPassword,
      email_confirm: true,
    });
  expect(patientUserError).toBeNull();
  createdUserIds.push(patientUser!.user!.id);
  const { error: patientAccountError } = await admin
    .from("patient_accounts")
    .insert({ id: patientUser!.user!.id, email: patientEmail });
  expect(patientAccountError).toBeNull();

  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: "Cancelada Web",
      email: patientEmail,
      is_patient: true,
      birth_date: "1990-01-01",
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);

  const date = futureDate(10);
  const appointmentId = await createAppointment({
    professionalId: employee.id,
    patientId: person!.id,
    serviceId: PSICOLOGIA_SERVICE_ID,
    date,
    time: "10:00",
    endTime: "11:00",
  });

  const patientClient = createClient("http://127.0.0.1:54321", anonKey ?? "");
  const { error: signInError } = await patientClient.auth.signInWithPassword({
    email: patientEmail,
    password: patientPassword,
  });
  expect(signInError).toBeNull();
  const { error: cancelError } = await patientClient.rpc(
    "cancel_my_appointment",
    { p_appointment_id: appointmentId },
  );
  expect(cancelError).toBeNull();

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${appointmentId}`);

  await expect(page.getByTestId("appointment-history")).toContainText(
    "Cancelada desde la web el",
  );
});
