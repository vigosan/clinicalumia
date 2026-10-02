import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { logOut, signIn } from "./auth";
import { pickTime } from "./date-time";
import {
  collectAsStaff,
  deleteInvoicesOfAppointments,
  replaceWithFullInvoiceAsStaff,
} from "./invoices";
import { selectOption } from "./select";

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

async function createEmployee(
  fullName: string,
  role: "employee" | "owner" = "employee",
) {
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
    role,
    specialty_id: PSICOLOGIA_SPECIALTY_ID,
    is_active: true,
  });
  expect(profileError).toBeNull();
  return { id: data.user!.id, email, password, fullName };
}

async function createAppointment(
  professionalId: string,
  date: string,
  startTime = "10:00",
  endTime = "11:00",
) {
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
      starts_at: `${date} ${startTime}:00 Europe/Madrid`,
      ends_at: `${date} ${endTime}:00 Europe/Madrid`,
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

  await expect(page.getByTestId("toast")).toHaveText(
    "Cobro registrado · 55,00 € en efectivo",
  );
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Efectivo",
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
    "Cobrada · 40,00 € · Efectivo",
  );
});

test("cobrar 450 € pide los datos del destinatario y emite directamente una factura completa, sin simplificada", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -5);
  const employee = await createEmployee("Profesional Cobro Completa");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await page.getByTestId("payment-collect").click();
  await page.getByTestId("payment-amount").fill("400");
  await expect(page.getByTestId("payment-recipient")).toHaveCount(0);
  await page.getByTestId("payment-amount").fill("450");
  await expect(page.getByTestId("payment-recipient")).toBeVisible();
  await page.getByTestId("payment-note").fill("Bono de diez sesiones");
  await page.getByTestId("payment-method-card").check();
  await page.getByTestId("payment-recipient-name").fill("Marta Soler Vidal");
  await page.getByTestId("payment-recipient-tax-id").fill("12345678A");
  await page.getByTestId("payment-recipient-address").fill("Calle Sol 2");
  await page.getByTestId("payment-recipient-postal-code").fill("46800");
  await page.getByTestId("payment-recipient-city").fill("Xàtiva");
  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("payment-error")).toHaveText(
    "Escribe un DNI, NIE o CIF válido. Otros documentos (pasaporte, NIF extranjero) no se admiten todavía.",
  );

  await page.getByTestId("payment-recipient-tax-id").fill("12345678Z");
  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 450,00 € · Tarjeta",
  );

  const { data: invoices, error } = await admin
    .from("invoices")
    .select(
      "code, kind, status, replaces_invoice_id, total_cents, snapshot, payments!inner(appointment_id)",
    )
    .eq("payments.appointment_id", appointmentId);
  expect(error).toBeNull();
  expect(invoices).toHaveLength(1);
  expect(invoices![0]).toMatchObject({
    kind: "full",
    status: "issued",
    replaces_invoice_id: null,
    total_cents: 45000,
    snapshot: { recipient: { name: "Marta Soler Vidal", tax_id: "12345678Z" } },
  });
  await expect(page.getByTestId("invoice-code")).toHaveText(
    `Factura ${invoices![0]!.code}`,
  );
  await expect(page.getByTestId("invoice-full")).toHaveCount(0);
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
    "Cobrada · 55,00 € · Efectivo",
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
    "Cobrada · 55,00 € · Efectivo",
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
    "Cobrada · 55,00 € · Bizum",
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
    "Cobrada · 55,00 € · Tarjeta",
  );
  await expect(page.getByTestId("payment-void")).toHaveCount(0);
});

function todayLabel(): string {
  const today = todayInMadrid();
  return `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`;
}

test("una cita futura cobrada por adelantado se mueve a otra hora sin anular el cobro, la factura no cambia y el panel dice cuándo se emitió", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), 5);
  const employee = await createEmployee("Profesional Cobro Futura");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);

  await expect(page.getByTestId("appointment-payment-status")).toHaveCount(0);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Tarjeta",
  );
  const invoiceCode = await page.getByTestId("invoice-code").textContent();

  await pickTime(page.getByTestId("appointment-move-time"), "12:00");
  await page.getByTestId("appointment-move").click();
  await page.getByTestId("appointment-confirm").click();

  await expect(
    page.getByTestId("toast").filter({ hasText: "Cita cambiada" }),
  ).toBeVisible();
  await expect(page.getByTestId("appointment-panel-date")).toContainText(
    "12:00",
  );
  await expect(page.getByTestId("appointment-history")).toContainText(
    "Movida de",
  );
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Tarjeta",
  );
  await expect(page.getByTestId("invoice-code")).toHaveText(invoiceCode!);
  await expect(page.getByTestId("invoice-issued")).toHaveText(
    `Factura emitida el ${todayLabel()}`,
  );
});

test("la propietaria no puede pasar a otra profesional una cita ya cobrada, y el panel le dice que anule antes el cobro", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), 7);
  const employee = await createEmployee("Profesional Cobro Reasignar");
  const owner = await createEmployee("Propietaria Cobro Reasignar", "owner");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, owner.email, owner.password);
  await openAppointment(page, date, appointmentId);
  await expect(page.getByTestId("appointment-move-professional")).toBeEnabled();

  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Tarjeta",
  );

  await expect(
    page.getByTestId("appointment-move-professional"),
  ).toBeDisabled();
  await expect(page.getByTestId("appointment-move-form")).toContainText(
    "Para cambiar de profesional una cita cobrada, anula antes el cobro.",
  );
});

test("cancelar una cita cobrada con «Emitir rectificativa» la cancela y anula el cobro en un solo paso, sin pasar por Facturas", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), 6);
  const employee = await createEmployee("Profesional Cobro Cancelar");
  const appointmentId = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Tarjeta",
  );

  await page.getByTestId("appointment-cancel").click();
  await expect(page.getByTestId("cancel-invoiced-warning")).toContainText(
    "Esta cita está cobrada y facturada.",
  );
  await expect(page.getByTestId("cancel-confirm")).toHaveText("Cancelar cita");
  await page.getByTestId("cancel-rectify").check();
  await expect(page.getByTestId("cancel-confirm")).toHaveText(
    "Emitir rectificativa y cancelar",
  );
  await page.getByTestId("cancel-reason").fill("No puede venir");
  await page.getByTestId("cancel-confirm").click();

  await expect(
    page
      .getByTestId("toast")
      .filter({ hasText: "Cita cancelada y rectificativa emitida" }),
  ).toBeVisible();
  await expect(page.getByTestId("appointment-status")).toHaveText("Cancelada");
  await expect(page.getByTestId("appointment-history")).toContainText(
    `Cobro anulado · No puede venir por ${employee.fullName} el`,
  );

  const { data: payment, error } = await admin
    .from("payments")
    .select("voided_at, invoices(kind)")
    .eq("appointment_id", appointmentId)
    .single();
  expect(error).toBeNull();
  expect(payment!.voided_at).not.toBeNull();
  expect(payment!.invoices.map((invoice) => invoice.kind).sort()).toEqual([
    "rectifying",
    "simplified",
  ]);
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
        "Cobrada · 55,00 € · Efectivo",
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

test("la página de cobros muestra los cobros del día con sus totales por forma de pago, el anulado el mismo día se ve con su anulación y no suma, y el filtro por profesional funciona", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -1);
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
    "Cobrada · 55,00 € · Efectivo",
  );
  await openAppointment(page, date, cardAppointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Tarjeta",
  );
  await openAppointment(page, date, voidedAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Efectivo",
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
  ).toHaveText("Válido");
  const today = todayInMadrid();
  await expect(
    page
      .getByTestId("payment-row")
      .filter({ hasText: voidedPatientName })
      .getByTestId("payment-state"),
  ).toHaveText([
    `Anulado el ${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
    "Anulado · Cobrado por error",
  ]);

  await selectOption(page.getByTestId("payments-professional"), employee.id);
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="cash"]'),
  ).toContainText("55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText("55,00 €");

  await selectOption(
    page.getByTestId("payments-professional"),
    secondEmployee.id,
  );
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="card"]'),
  ).toContainText("55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText("55,00 €");

  await selectOption(
    page.getByTestId("payments-professional"),
    otherEmployee.id,
  );
  await expect(page.getByTestId("payment-row")).toHaveCount(2);
  await expect(page.getByTestId("payment-row-amount")).toHaveText([
    "55,00 €",
    "-55,00 €",
  ]);
  await expect(page.getByTestId("payments-total-method")).toHaveCount(0);
  await expect(page.getByTestId("payments-total-amount")).toHaveText("0,00 €");
});

test("una anulación sale en Cobros el día en que se anula, en negativo, y la caja del día del cobro no cambia", async ({
  page,
}) => {
  const today = todayInMadrid();
  const yesterday = addDays(today, -1);
  const employee = await createEmployee("Profesional Anulación Otro Día");
  const appointmentId = await createAppointment(
    employee.id,
    addDays(today, -3),
  );
  collectAsStaff(employee.id, appointmentId, 5500);
  const { error: backdateError } = await admin
    .from("payments")
    .update({ collected_at: `${yesterday} 12:00:00 Europe/Madrid` })
    .eq("appointment_id", appointmentId);
  expect(backdateError).toBeNull();

  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await openAppointment(page, addDays(today, -3), appointmentId);
  await page.getByTestId("payment-void").click();
  await page.getByTestId("payment-void-reason").fill("Devuelto al paciente");
  await page.getByTestId("payment-void-confirm").click();
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pendiente de cobro",
  );

  await page.goto(
    `${DASHBOARD}/cobros?desde=${yesterday}&hasta=${yesterday}&profesional=${employee.id}`,
  );
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(page.getByTestId("payment-row")).toHaveAttribute(
    "data-entry",
    "collected",
  );
  await expect(page.getByTestId("payment-row-amount")).toHaveText("55,00 €");
  await expect(page.getByTestId("payment-state")).toHaveText(
    `Anulado el ${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
  );
  await expect(page.getByTestId("payments-total-amount")).toHaveText("55,00 €");

  await page.goto(
    `${DASHBOARD}/cobros?desde=${today}&hasta=${today}&profesional=${employee.id}`,
  );
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(page.getByTestId("payment-row")).toHaveAttribute(
    "data-entry",
    "voided",
  );
  await expect(page.getByTestId("payment-row-amount")).toHaveText("-55,00 €");
  await expect(page.getByTestId("payment-state")).toHaveText(
    "Anulado · Devuelto al paciente",
  );
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="card"]'),
  ).toContainText("-55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText(
    "-55,00 €",
  );

  await page.goto(
    `${DASHBOARD}/cobros?desde=${yesterday}&hasta=${today}&profesional=${employee.id}`,
  );
  await expect(page.getByTestId("payment-row")).toHaveCount(2);
  await expect(page.getByTestId("payments-total-amount")).toHaveText("0,00 €");
});

test("la agenda marca cada cita con un icono de cobrada, pendiente o no presentada, también en el móvil", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -3);
  const employee = await createEmployee("Profesional Iconos Agenda");
  const paidId = await createAppointment(employee.id, date, "09:00", "10:00");
  const pendingId = await createAppointment(
    employee.id,
    date,
    "11:00",
    "12:00",
  );
  const noShowId = await createAppointment(employee.id, date, "13:00", "14:00");
  collectAsStaff(employee.id, paidId, 5500);
  const { error: noShowError } = await admin
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", noShowId);
  expect(noShowError).toBeNull();

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/?date=${date}`);

  const block = (appointmentId: string) =>
    page
      .locator(
        `[data-testid="appointment-block"][data-appointment="${appointmentId}"]`,
      )
      .filter({ visible: true });
  const icon = (appointmentId: string) =>
    block(appointmentId).getByTestId("appointment-payment-icon");
  const expectIcons = async () => {
    await expect(icon(paidId)).toHaveAttribute("data-state", "paid");
    await expect(icon(paidId)).toHaveText("Cobrada");
    await expect(icon(pendingId)).toHaveAttribute("data-state", "pending");
    await expect(icon(pendingId)).toHaveText("Pendiente de cobro");
    await expect(icon(noShowId)).toHaveAttribute("data-state", "no_show");
    await expect(icon(noShowId)).toHaveText("No presentada");
    for (const id of [paidId, pendingId, noShowId]) {
      await expect(icon(id).locator("svg")).toBeVisible();
    }
  };
  await expectIcons();
  await expect(block(pendingId)).toContainText(await patientNameOf(pendingId));

  await page.setViewportSize({ width: 1280, height: 900 });
  await expectIcons();
});

test("la pestaña Pendientes cuenta las citas sin cobrar, se cobra desde ella sin salir de Cobros, y una cancelada no aparece", async ({
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

  await expect(page).toHaveURL(`${DASHBOARD}/cobros?tab=pendientes`);
  const pendingTab = page.getByTestId("payments-tab-pendientes");
  await expect(pendingTab).toHaveAttribute("aria-selected", "true");
  await expect(pendingTab).toHaveText("Pendientes (1)");
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

  const collect = page
    .getByTestId("pending-payment-row")
    .filter({ hasText: pendingPatientName })
    .getByTestId("pending-payment-collect");
  const dialog = page.getByTestId("payment-register-dialog");
  await collect.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("payment-selected")).toContainText(
    pendingPatientName,
  );
  await expect(dialog.getByTestId("payment-change-appointment")).toHaveCount(0);
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!;
      return [Math.round(box.x + box.width), Math.round(box.height)];
    })
    .toEqual([viewport.width, viewport.height]);
  await dialog.getByTestId("payment-method-cash").check();
  await dialog.getByTestId("payment-submit").click();

  await expect(page.getByTestId("toast")).toContainText(
    "Cobro registrado · 55,00 € en efectivo",
  );
  await expect(dialog).toHaveCount(0);
  await expect(pendingTab).toHaveText("Pendientes (0)");
  await expect(pendingTab).toBeFocused();
  await expect(page.getByTestId("pending-payment-row")).toHaveCount(0);
  await expect(page.getByTestId("payments-pending-empty")).toBeVisible();
});

test("una cita no presentada no sale en Pendientes ni en «Registrar cobro», y su panel no la da por pendiente de cobro", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -3);
  const noShowDate = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional No Presentada Cobros");
  const pendingAppointmentId = await createAppointment(employee.id, date);
  const noShowAppointmentId = await createAppointment(employee.id, noShowDate);
  const { error: noShowError } = await admin
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", noShowAppointmentId);
  expect(noShowError).toBeNull();
  const pendingPatientName = await patientNameOf(pendingAppointmentId);
  const noShowPatientName = await patientNameOf(noShowAppointmentId);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/cobros?tab=pendientes`);

  await expect(page.getByTestId("payments-tab-pendientes")).toHaveText(
    "Pendientes (1)",
  );
  await expect(page.getByTestId("pending-payment-row")).toHaveCount(1);
  await expect(page.getByTestId("pending-payment-row")).toContainText(
    pendingPatientName,
  );

  await page.getByTestId("payments-register").click();
  const dialog = page.getByTestId("payment-register-dialog");
  await expect(dialog.getByTestId("payment-candidate")).toHaveText([
    new RegExp(pendingPatientName),
  ]);
  await dialog.getByTestId("payment-candidate-search").fill(noShowPatientName);
  await expect(dialog.getByTestId("payment-candidates-empty")).toBeVisible();

  await openAppointment(page, noShowDate, noShowAppointmentId);
  await expect(page.getByTestId("appointment-status")).toHaveText(
    "No presentada",
  );
  await expect(page.getByTestId("appointment-payment-status")).toHaveCount(0);
});

test("«Registrar cobro» en /cobros pone primero las citas de hoy, busca por paciente y, al cobrar, avisa y actualiza la lista y los totales", async ({
  page,
}) => {
  const today = todayInMadrid();
  const employee = await createEmployee("Profesional Registrar Cobro");
  const todayAppointmentId = await createAppointment(employee.id, today);
  const pastAppointmentId = await createAppointment(
    employee.id,
    addDays(today, -2),
  );
  const todayPatientName = await patientNameOf(todayAppointmentId);
  const pastPatientName = await patientNameOf(pastAppointmentId);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/cobros`);
  await expect(page.getByTestId("payments-empty")).toContainText(
    "No hay cobros en estas fechas.",
  );
  await expect(page.getByTestId("payments-empty")).toContainText(
    "Usa «Registrar cobro» o revisa «Pendientes».",
  );

  await page.getByTestId("payments-register").click();
  const dialog = page.getByTestId("payment-register-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("payment-candidate-search")).toBeFocused();
  await expect(
    dialog
      .getByTestId("payment-candidates-today")
      .getByTestId("payment-candidate"),
  ).toHaveText([new RegExp(todayPatientName)]);
  await expect(
    dialog
      .getByTestId("payment-candidates-earlier")
      .getByTestId("payment-candidate"),
  ).toHaveText([new RegExp(pastPatientName)]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("payments-register")).toBeFocused();

  await page.getByTestId("payments-register").click();
  await dialog
    .getByTestId("payment-candidate-search")
    .fill(pastPatientName.toLowerCase());
  await expect(dialog.getByTestId("payment-candidate")).toHaveText([
    new RegExp(pastPatientName),
  ]);
  await dialog.getByTestId("payment-candidate-search").fill("zzz-nadie");
  await expect(dialog.getByTestId("payment-candidates-empty")).toBeVisible();
  await dialog.getByTestId("payment-candidate-search").fill("");

  await dialog
    .getByTestId("payment-candidate")
    .filter({ hasText: todayPatientName })
    .click();
  await expect(dialog.getByTestId("payment-selected")).toContainText(
    todayPatientName,
  );
  await dialog.getByTestId("payment-change-appointment").click();
  await expect(dialog.getByTestId("payment-candidate-search")).toBeVisible();
  await dialog
    .getByTestId("payment-candidate")
    .filter({ hasText: todayPatientName })
    .click();
  await expect(dialog.getByTestId("payment-amount")).toHaveValue("55,00");
  await dialog.getByTestId("payment-method-card").check();
  await dialog.getByTestId("payment-submit").click();

  await expect(page.getByTestId("toast")).toContainText(
    "Cobro registrado · 55,00 € con tarjeta",
  );
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByTestId("payment-row").filter({ hasText: todayPatientName }),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="card"]'),
  ).toContainText("55,00 €");
  await expect(page.getByTestId("payments-total-amount")).toHaveText("55,00 €");
  const { data: payments, error } = await admin
    .from("payments")
    .select("method, amount_cents, collected_by")
    .eq("appointment_id", todayAppointmentId);
  expect(error).toBeNull();
  expect(payments).toEqual([
    { method: "card", amount_cents: 5500, collected_by: employee.id },
  ]);

  await page.getByTestId("payments-register").click();
  await expect(
    dialog
      .getByTestId("payment-candidate")
      .filter({ hasText: todayPatientName }),
  ).toHaveCount(0);
});

test("en «Registrar cobro» y en Pendientes un empleado solo ve las citas de las que es profesional", async ({
  page,
}) => {
  const today = todayInMadrid();
  const employee = await createEmployee("Profesional Cobro Propio");
  const colleague = await createEmployee("Profesional Cobro Ajeno");
  const ownAppointmentId = await createAppointment(
    employee.id,
    today,
    "23:30",
    "23:55",
  );
  const colleagueTodayId = await createAppointment(
    colleague.id,
    today,
    "23:30",
    "23:55",
  );
  const colleaguePastId = await createAppointment(
    colleague.id,
    addDays(today, -2),
  );
  const ownPatientName = await patientNameOf(ownAppointmentId);
  const colleagueTodayName = await patientNameOf(colleagueTodayId);
  const colleaguePastName = await patientNameOf(colleaguePastId);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/cobros`);
  await page.getByTestId("payments-register").click();
  const dialog = page.getByTestId("payment-register-dialog");
  await expect(
    dialog
      .getByTestId("payment-candidates-today")
      .getByTestId("payment-candidate")
      .filter({ hasText: ownPatientName }),
  ).toHaveCount(1);
  await expect(
    dialog
      .getByTestId("payment-candidate")
      .filter({ hasText: colleagueTodayName }),
  ).toHaveCount(0);
  await expect(
    dialog
      .getByTestId("payment-candidate")
      .filter({ hasText: colleaguePastName }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByTestId("payments-tab-pendientes").click();
  await expect(page).toHaveURL(`${DASHBOARD}/cobros?tab=pendientes`);
  await expect(
    page
      .getByTestId("pending-payment-row")
      .filter({ hasText: colleaguePastName }),
  ).toHaveCount(0);

  await logOut(page);
  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await page.goto(`${DASHBOARD}/cobros`);
  await page.getByTestId("payments-register").click();
  await dialog.getByTestId("payment-candidate-search").fill(colleagueTodayName);
  await expect(
    dialog
      .getByTestId("payment-candidates-today")
      .getByTestId("payment-candidate"),
  ).toHaveText([new RegExp(colleagueTodayName)]);
});

test("desde la ficha se ve si cada cita está cobrada, se cobra una pendiente con «Cobrar» y aparece en la tarjeta Cobros", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -3);
  const employee = await createEmployee("Profesional Cobro Ficha");
  const appointmentId = await createAppointment(employee.id, date);
  const { data: appointment, error } = await admin
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .single();
  expect(error).toBeNull();

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await page.goto(`${DASHBOARD}/patients/${appointment!.patient_id}`);

  await expect(page.getByTestId("patient-appointment")).toContainText(
    "Realizada · Pendiente de cobro",
  );
  await expect(page.getByTestId("guardians-section")).toHaveCount(0);
  const card = page.getByTestId("patient-payments");
  await expect(card.getByTestId("patient-payment")).toHaveCount(0);
  await card
    .getByTestId("patient-pending-payment")
    .getByTestId("patient-collect")
    .click();

  const dialog = page.getByTestId("payment-register-dialog");
  await expect(dialog.getByTestId("payment-amount")).toHaveValue("55,00");
  await dialog.getByTestId("payment-method-bizum").check();
  await dialog.getByTestId("payment-submit").click();

  await expect(page.getByTestId("toast")).toContainText(
    "Cobro registrado · 55,00 € por Bizum",
  );
  await expect(page.getByTestId("patient-payments-title")).toBeFocused();
  await expect(page.getByTestId("patient-appointment")).toContainText(
    "Realizada · Cobrada · 55,00 € · Bizum",
  );
  await expect(card.getByTestId("patient-pending-payment")).toHaveCount(0);
  await expect(card.getByTestId("patient-payment")).toHaveCount(1);
  await expect(card.getByTestId("patient-payment")).toContainText(
    "55,00 € · Bizum",
  );
  await expect(card.getByTestId("patient-payment")).toContainText("Válido");
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
    "Cobrada · 55,00 € · Tarjeta",
  );
  await logOut(page);
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, ownAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 55,00 € · Efectivo",
  );

  await page.goto(`${DASHBOARD}/cobros`);
  await expect(page.getByTestId("payments-list")).toBeVisible();
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="payments-total-method"][data-method="cash"]'),
  ).toContainText("55,00 €");
  await expect(page.getByTestId("payments-professional")).toHaveCount(0);
});

test("los atajos de fechas de Cobros eligen los días de Madrid y el calendario elige un rango con dos clics", async ({
  page,
}) => {
  const today = todayInMadrid();
  const yesterday = addDays(today, -1);
  const monthStart = `${today.slice(0, 7)}-01`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/cobros`);
  const range = page.getByTestId("payments-range");

  await range.click();
  await page.getByTestId("payments-range-preset-ayer").click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/cobros?desde=${yesterday}&hasta=${yesterday}`,
  );

  await range.click();
  await page.getByTestId("payments-range-preset-mes").click();
  await expect(page).toHaveURL(
    new RegExp(
      `/cobros\\?desde=${monthStart}&hasta=${today.slice(0, 7)}-\\d\\d$`,
    ),
  );

  await range.click();
  const calendar = page.getByRole("dialog");
  await calendar.locator(`[data-day="${today}"] button`).click();
  await expect(calendar).toContainText("Elige el último día");
  await calendar.locator(`[data-day="${monthStart}"] button`).click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/cobros?desde=${monthStart}&hasta=${today}`,
  );
});

test("en Cobros las flechas de día van pegadas al calendario y el profesional en la misma línea, para cambiar de día sin buscar los controles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await page.goto(`${DASHBOARD}/cobros`);

  const range = page.getByRole("combobox", { name: "Fechas" });
  await expect(range).toBeVisible();
  const prev = await page.getByTestId("payments-prev-day").boundingBox();
  const field = await range.boundingBox();
  const next = await page.getByTestId("payments-next-day").boundingBox();
  const professional = await page
    .getByRole("combobox", { name: "Profesional" })
    .boundingBox();
  expect(prev && field && next && professional).toBeTruthy();
  expect(field!.x - (prev!.x + prev!.width)).toBeGreaterThanOrEqual(0);
  expect(field!.x - (prev!.x + prev!.width)).toBeLessThanOrEqual(8);
  expect(next!.x - (field!.x + field!.width)).toBeGreaterThanOrEqual(0);
  expect(next!.x - (field!.x + field!.width)).toBeLessThanOrEqual(8);
  const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
  expect(Math.abs(middle(prev!) - middle(field!))).toBeLessThanOrEqual(2);
  expect(Math.abs(middle(professional!) - middle(field!))).toBeLessThanOrEqual(
    2,
  );
});

test("el total del día se lee como una cifra grande y el desglose por forma de pago cabe en una sola línea, sin tarjetas", async ({
  page,
}) => {
  const date = todayInMadrid();
  const employee = await createEmployee("Profesional Cobros Totales");
  const cardAppointmentId = await createAppointment(employee.id, date);
  const cashAppointmentId = await createAppointment(
    employee.id,
    date,
    "12:00",
    "13:00",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, cardAppointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toContainText(
    "Cobrada",
  );
  await openAppointment(page, date, cashAppointmentId);
  await collect(page, "cash");
  await expect(page.getByTestId("appointment-payment-status")).toContainText(
    "Cobrada",
  );

  await page.goto(`${DASHBOARD}/cobros`);
  const total = page.getByTestId("payments-total-amount");
  await expect(total).toHaveText("110,00 €");
  expect(
    await total.evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe("32px");
  const methods = page.getByTestId("payments-total-method");
  await expect(methods).toHaveCount(2);
  const boxes = await Promise.all(
    (await methods.all()).map((method) => method.boundingBox()),
  );
  const totalBox = await total.boundingBox();
  for (const box of boxes) {
    expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThanOrEqual(2);
    expect(box!.height).toBeLessThanOrEqual(28);
    expect(box!.x).toBeGreaterThan(totalBox!.x + totalBox!.width);
  }
});

test("a 390 px Cobros y Facturas se leen como tarjetas, sin desplazar la página de lado", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Cobros Móvil");
  const appointmentId = await createAppointment(employee.id, date);

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointmentId);
  await collect(page, "card");
  await expect(page.getByTestId("appointment-payment-status")).toContainText(
    "Cobrada",
  );

  for (const path of ["/cobros", "/facturas"]) {
    await page.goto(`${DASHBOARD}${path}`);
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await table.evaluate((element) => {
        const wrapper = element.parentElement as HTMLElement;
        return wrapper.scrollWidth <= wrapper.clientWidth;
      }),
    ).toBe(true);
  }
});

test("cobrar 450 € a un paciente que ya tuvo factura completa rellena el destinatario con los datos de esa factura", async ({
  page,
}) => {
  const employee = await createEmployee("Profesional Cobro Precarga");
  const firstDate = addDays(todayInMadrid(), -6);
  const firstId = await createAppointment(employee.id, firstDate);
  collectAsStaff(employee.id, firstId, 5500);
  replaceWithFullInvoiceAsStaff(employee.id, firstId, {
    name: "Talleres Auditoría",
    taxId: "B98765431",
  });
  const { data: first, error: firstError } = await admin
    .from("appointments")
    .select("patient_id")
    .eq("id", firstId)
    .single();
  expect(firstError).toBeNull();
  const date = addDays(todayInMadrid(), -5);
  const { data: second, error } = await admin
    .from("appointments")
    .insert({
      professional_id: employee.id,
      patient_id: first!.patient_id,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${date} 10:00:00 Europe/Madrid`,
      ends_at: `${date} 11:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(second!.id);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, second!.id);
  await page.getByTestId("payment-collect").click();
  await page.getByTestId("payment-amount").fill("450");
  await expect(page.getByTestId("payment-recipient-name")).toHaveValue(
    "Talleres Auditoría",
  );
  await expect(page.getByTestId("payment-recipient-tax-id")).toHaveValue(
    "B98765431",
  );
  await expect(page.getByTestId("payment-recipient-city")).toHaveValue(
    "Xàtiva",
  );
  await page.getByTestId("payment-note").fill("Bono de diez sesiones");
  await page.getByTestId("payment-method-card").check();
  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Cobrada · 450,00 € · Tarjeta",
  );
});
