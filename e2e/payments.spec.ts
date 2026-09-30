import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { deleteInvoicesOfAppointments } from "./invoices";

const DASHBOARD = "http://localhost:3001";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";

const createdAppointmentIds: string[] = [];
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createEmployee(fullName: string) {
  const email = `cobros-${uniqueSuffix()}@test.local`;
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
    role: "employee",
    specialty_id: PSICOLOGIA_SPECIALTY_ID,
    is_active: true,
  });
  expect(profileError).toBeNull();
  return { id: data.user!.id, email, password, fullName };
}

async function createAppointment(professionalId: string, date: string) {
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: `Cobro${uniqueSuffix()}`,
      birth_date: "1990-05-12",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);
  const { data, error } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      patient_id: person!.id,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${date} 10:00:00 Europe/Madrid`,
      ends_at: `${date} 11:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(data!.id);
  return data!.id as string;
}

async function patientNameOf(appointmentId: string): Promise<string> {
  const { data, error } = await admin
    .from("appointments")
    .select("patient:people(first_name, last_name)")
    .eq("id", appointmentId)
    .single();
  expect(error).toBeNull();
  return `${data!.patient!.first_name} ${data!.patient!.last_name}`;
}

async function openAppointment(page: Page, date: string, id: string) {
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${id}`);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
}

async function collect(page: Page, method: string) {
  await page.getByTestId("payment-collect").click();
  await page.getByTestId(`payment-method-${method}`).check();
  await page.getByTestId("payment-submit").click();
}

test.afterEach(async () => {
  const errors: unknown[] = [];
  const appointmentIds = createdAppointmentIds.splice(0);
  if (appointmentIds.length > 0) {
    deleteInvoicesOfAppointments(appointmentIds);
    const { error: paymentsError } = await admin
      .from("payments")
      .delete()
      .in("appointment_id", appointmentIds);
    if (paymentsError) errors.push(paymentsError);
    const { error } = await admin
      .from("appointments")
      .delete()
      .in("id", appointmentIds);
    if (error) errors.push(error);
  }
  const personIds = createdPersonIds.splice(0);
  if (personIds.length > 0) {
    const { error } = await admin.from("people").delete().in("id", personIds);
    if (error) errors.push(error);
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errors.push(error);
  }
  expect(errors).toEqual([]);
});

test("cobrar en efectivo una cita pasada la deja pagada y lo apunta en el historial, sin cerrar el panel", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -3);
  const employee = await createEmployee("Profesional Cobro Efectivo");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pendiente de cobro",
  );
  await page.getByTestId("payment-collect").click();
  await expect(page.getByTestId("payment-amount")).toHaveValue("55,00");
  await expect(page.getByTestId("payment-method-cash")).toBeChecked();
  await expect(page.getByTestId("payment-note")).toHaveCount(0);
  await page.getByTestId("payment-submit").click();

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await expect(page.getByTestId("appointment-history")).toContainText(
    `Cobrada · 55,00 € · Efectivo por ${employee.fullName} el`,
  );
  await expect(page.getByTestId("payment-collect")).toHaveCount(0);
});

test("cobrar un importe distinto del propuesto pide el motivo y con él se registra", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -4);
  const employee = await createEmployee("Profesional Cobro Motivo");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await page.getByTestId("payment-collect").click();
  await page.getByTestId("payment-amount").fill("40");
  await expect(page.getByTestId("payment-note")).toBeVisible();
  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("payment-error")).toHaveText(
    "Indica el motivo del cambio de importe.",
  );

  await page.getByTestId("payment-note").fill("Descuento de familia");
  await page.getByTestId("payment-submit").click();

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 40,00 €",
  );
});

test("si la señal se paga en la web mientras el formulario está abierto, aparece el campo de motivo para poder explicar la diferencia", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -4);
  const employee = await createEmployee("Profesional Cobro Señal Pagada");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await page.getByTestId("payment-collect").click();
  await expect(page.getByTestId("payment-note")).toHaveCount(0);

  const { error } = await admin
    .from("appointments")
    .update({ payment_status: "paid" })
    .eq("id", appointmentId);
  expect(error).toBeNull();

  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("payment-error")).toHaveText(
    "Indica el motivo del cambio de importe.",
  );
  await expect(page.getByTestId("payment-note")).toBeVisible();

  await page.getByTestId("payment-note").fill("Precio antiguo");
  await page.getByTestId("payment-submit").click();

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );
});

test("anular un cobro con motivo lo deja pendiente y se puede volver a cobrar con Bizum", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -5);
  const employee = await createEmployee("Profesional Cobro Anular");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );

  await page.getByTestId("payment-void").click();
  await expect(page.getByTestId("payment-void-confirm")).toHaveText(
    "Emitir rectificativa y anular cobro",
  );
  await page.getByTestId("payment-void-reason").fill("Pagó con Bizum");
  await page.getByTestId("payment-void-confirm").click();

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pendiente de cobro",
  );
  await expect(page.getByTestId("appointment-history")).toContainText(
    `Cobro anulado · Pagó con Bizum por ${employee.fullName} el`,
  );

  await collect(page, "bizum");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Bizum · 55,00 €",
  );
});

test("una empleada no ve «Anular cobro» en el cobro que registró otra persona", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -6);
  const employee = await createEmployee("Profesional Cobro Ajeno");
  const colleague = await createEmployee("Compañera Cobro Ajeno");
  const appointmentId = await createAppointment(employee.id, date);
  const { error } = await admin.from("payments").insert({
    appointment_id: appointmentId,
    amount_cents: 5500,
    method: "card",
    vat: "exempt",
    collected_by: colleague.id,
  });
  expect(error).toBeNull();

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Tarjeta · 55,00 €",
  );
  await expect(page.getByTestId("payment-void")).toHaveCount(0);
});

test("una cita futura no se puede cobrar todavía", async ({ page }) => {
  const date = addDays(todayInMadrid(), 5);
  const employee = await createEmployee("Profesional Cobro Futura");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await expect(page.getByTestId("payment-collect")).toHaveCount(0);
  await expect(page.getByTestId("appointment-payment-status")).toHaveCount(0);
});

test("si dos pestañas cobran la misma cita a la vez, solo una lo consigue y la otra se actualiza para mostrarla cobrada", async ({
  browser,
}) => {
  const date = addDays(todayInMadrid(), -7);
  const employee = await createEmployee("Profesional Cobro Doble");
  const appointmentId = await createAppointment(employee.id, date);

  const firstContext = await browser.newContext();
  const first = await firstContext.newPage();
  await signIn(first, DASHBOARD, employee.email, employee.password);
  const secondContext = await browser.newContext({
    storageState: await firstContext.storageState(),
  });
  const second = await secondContext.newPage();

  try {
    for (const page of [first, second]) {
      await openAppointment(page, date, appointmentId);
      await page.getByTestId("payment-collect").click();
      await expect(page.getByTestId("payment-submit")).toBeEnabled();
    }

    await Promise.all([
      first.getByTestId("payment-submit").click(),
      second.getByTestId("payment-submit").click(),
    ]);

    for (const page of [first, second]) {
      await expect(page.getByTestId("appointment-payment-status")).toHaveText(
        "Pagada · Efectivo · 55,00 €",
      );
      await expect(page.getByTestId("payment-form")).toHaveCount(0);
      await expect(page.getByTestId("payment-collect")).toHaveCount(0);
    }

    const { data: payments, error } = await admin
      .from("payments")
      .select("id")
      .eq("appointment_id", appointmentId)
      .is("voided_at", null);
    expect(error).toBeNull();
    expect(payments).toHaveLength(1);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

test("la página de cobros muestra los cobros del día con sus totales por forma de pago, el anulado se ve pero no suma, y el filtro por profesional funciona", async ({
  page,
}) => {
  const date = todayInMadrid();
  const employee = await createEmployee("Profesional Lista Cobros");
  const secondEmployee = await createEmployee("Profesional Lista Cobros Dos");
  const otherEmployee = await createEmployee("Profesional Lista Cobros Tres");
  const cashAppointmentId = await createAppointment(employee.id, date);
  const cardAppointmentId = await createAppointment(secondEmployee.id, date);
  const voidedAppointmentId = await createAppointment(otherEmployee.id, date);
  const cashPatientName = await patientNameOf(cashAppointmentId);
  const cardPatientName = await patientNameOf(cardAppointmentId);
  const voidedPatientName = await patientNameOf(voidedAppointmentId);

  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await openAppointment(page, date, cashAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );
  await openAppointment(page, date, cardAppointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Tarjeta · 55,00 €",
  );
  await openAppointment(page, date, voidedAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );
  await page.getByTestId("payment-void").click();
  await expect(page.getByTestId("payment-void-confirm")).toHaveText(
    "Emitir rectificativa y anular cobro",
  );
  await page.getByTestId("payment-void-reason").fill("Cobrado por error");
  await page.getByTestId("payment-void-confirm").click();
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pendiente de cobro",
  );

  await page.goto(`${DASHBOARD}/cobros`);
  await expect(page.getByTestId("payments-list")).toBeVisible();
  await expect(
    page.getByTestId("payment-row").filter({ hasText: cashPatientName }),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("payment-row").filter({ hasText: cardPatientName }),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("payment-row")
      .filter({ hasText: cashPatientName })
      .getByTestId("payment-state"),
  ).toHaveText("Vigente");
  await expect(
    page
      .getByTestId("payment-row")
      .filter({ hasText: voidedPatientName })
      .getByTestId("payment-state"),
  ).toHaveText("Anulado · Cobrado por error");

  await page.getByTestId("payments-professional").selectOption(employee.id);
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="cash"]'),
  ).toHaveText("Efectivo: 55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText(
    "Total: 55,00 €",
  );

  await page
    .getByTestId("payments-professional")
    .selectOption(secondEmployee.id);
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="card"]'),
  ).toHaveText("Tarjeta: 55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText(
    "Total: 55,00 €",
  );

  await page
    .getByTestId("payments-professional")
    .selectOption(otherEmployee.id);
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(page.getByTestId("payment-state")).toHaveText(
    "Anulado · Cobrado por error",
  );
  await expect(page.getByTestId("payments-total-method")).toHaveCount(0);
  await expect(page.getByTestId("payments-total-amount")).toHaveText(
    "Total: 0,00 €",
  );
});

test("una cita pasada sin cobro aparece en pendientes de cobro, desaparece al cobrarla, y una cancelada no aparece", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -3);
  const cancelledDate = addDays(todayInMadrid(), -4);
  const employee = await createEmployee("Profesional Pendientes");
  const pendingAppointmentId = await createAppointment(employee.id, date);
  const cancelledAppointmentId = await createAppointment(
    employee.id,
    cancelledDate,
  );
  const { error: cancelError } = await admin
    .from("appointments")
    .update({ status: "cancelled", cancelled_by: "clinic" })
    .eq("id", cancelledAppointmentId);
  expect(cancelError).toBeNull();
  const pendingPatientName = await patientNameOf(pendingAppointmentId);
  const cancelledPatientName = await patientNameOf(cancelledAppointmentId);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/cobros/pendientes`);

  await expect(
    page
      .getByTestId("pending-payment-row")
      .filter({ hasText: pendingPatientName }),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("pending-payment-row")
      .filter({ hasText: cancelledPatientName }),
  ).toHaveCount(0);

  await page
    .getByTestId("pending-payment-row")
    .filter({ hasText: pendingPatientName })
    .getByTestId("pending-payment-collect")
    .click();
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );

  await page.goto(`${DASHBOARD}/cobros/pendientes`);
  await expect(
    page
      .getByTestId("pending-payment-row")
      .filter({ hasText: pendingPatientName }),
  ).toHaveCount(0);
});

test("un empleado solo ve en /cobros los cobros de sus propias citas, sin el selector de profesional", async ({
  page,
}) => {
  const date = todayInMadrid();
  const employee = await createEmployee("Profesional Cobros Privados");
  const colleague = await createEmployee("Profesional Cobros Privados Dos");
  const ownAppointmentId = await createAppointment(employee.id, date);
  const colleagueAppointmentId = await createAppointment(colleague.id, date);

  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await openAppointment(page, date, colleagueAppointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Tarjeta · 55,00 €",
  );
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, ownAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pagada · Efectivo · 55,00 €",
  );

  await page.goto(`${DASHBOARD}/cobros`);
  await expect(page.getByTestId("payments-list")).toBeVisible();
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="cash"]'),
  ).toHaveText("Efectivo: 55,00 €");
  await expect(page.getByTestId("payments-professional")).toHaveCount(0);
});
