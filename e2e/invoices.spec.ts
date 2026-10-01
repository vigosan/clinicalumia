import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { logOut, signIn } from "./auth";
import { deleteInvoicesOfAppointments } from "./invoices";
import { latestEmailAttachments } from "./mail";

const DASHBOARD = "http://localhost:3001";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";
const INVOICE_CODE = /^Factura (\d+\/\d{2})$/;

const createdAppointmentIds: string[] = [];
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createEmployee(fullName: string) {
  const email = `facturas-${uniqueSuffix()}@test.local`;
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

async function createAppointment(
  professionalId: string,
  date: string,
  patient: { email?: string; tax_id?: string } = {},
  hour = 10,
) {
  const lastName = `Factura${uniqueSuffix()}`;
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      birth_date: "1990-05-12",
      is_patient: true,
      address: "Calle de la Factura 7",
      ...patient,
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
      starts_at: `${date} ${hour}:00:00 Europe/Madrid`,
      ends_at: `${date} ${hour + 1}:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(data!.id);
  return { id: data!.id as string, patientName: `Paciente ${lastName}` };
}

async function invoicesOf(appointmentId: string) {
  const { data, error } = await admin
    .from("invoices")
    .select("id, code, kind, status, payments!inner(appointment_id)")
    .eq("payments.appointment_id", appointmentId)
    .order("issued_at", { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

async function patientIdOf(appointmentId: string): Promise<string> {
  const { data, error } = await admin
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .single();
  expect(error).toBeNull();
  return data!.patient_id as string;
}

async function openAppointment(page: Page, date: string, id: string) {
  await page.goto(`${DASHBOARD}/?date=${date}&appointment=${id}`);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
}

async function collectAndReadCode(page: Page): Promise<string> {
  await page.getByTestId("payment-collect").click();
  await page.getByTestId("payment-method-card").check();
  await page.getByTestId("payment-submit").click();
  await expect(page.getByTestId("invoice-code")).toHaveText(INVOICE_CODE);
  const text = await page.getByTestId("invoice-code").textContent();
  return INVOICE_CODE.exec(text ?? "")?.[1] ?? "";
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

test("al cobrar se ve el número de la factura y «Ver / Imprimir» abre su PDF", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Ver");
  const appointment = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  const code = await collectAndReadCode(page);

  const [invoice] = await invoicesOf(appointment.id);
  expect(invoice).toMatchObject({ code, kind: "simplified" });
  await expect(page.getByTestId("invoice-view")).toHaveAttribute(
    "href",
    `/facturas/${invoice!.id}/pdf`,
  );
  await expect(page.getByTestId("invoice-view")).toHaveAttribute(
    "target",
    "_blank",
  );

  const response = await page.request.get(
    `${DASHBOARD}/facturas/${invoice!.id}/pdf`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("«Enviar por email» propone el email del paciente, valida lo escrito y deja en el buzón la factura en PDF", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Email");
  const patientEmail = `paciente-factura-${uniqueSuffix()}@test.local`;
  const appointment = await createAppointment(employee.id, date, {
    email: patientEmail,
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  const code = await collectAndReadCode(page);

  await page.getByTestId("invoice-send").click();
  await expect(page.getByTestId("invoice-send-email")).toHaveValue(
    patientEmail,
  );
  await page.getByTestId("invoice-send-email").fill("sin-arroba");
  await page.getByTestId("invoice-send-submit").click();
  await expect(page.getByTestId("invoice-send-error")).toHaveText(
    "Escribe un email válido.",
  );

  await page.getByTestId("invoice-send-email").fill(patientEmail);
  await page.getByTestId("invoice-send-submit").click();
  await expect(page.getByTestId("invoice-send-result")).toHaveText(
    `Factura enviada a ${patientEmail}`,
  );

  const attachments = await latestEmailAttachments(
    patientEmail,
    `Factura ${code} · Clínica LUMIA`,
  );
  expect(attachments).toEqual([`factura-${code.replace("/", "-")}.pdf`]);

  const [invoice] = await invoicesOf(appointment.id);
  const { data: sends, error } = await admin
    .from("invoice_emails")
    .select("sent_to, sent_by")
    .eq("invoice_id", invoice!.id);
  expect(error).toBeNull();
  expect(sends).toEqual([{ sent_to: patientEmail, sent_by: employee.id }]);
});

test("«Factura completa» rechaza un NIF inválido y, con uno válido, emite la completa que sustituye a la simplificada", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Completa");
  const appointment = await createAppointment(employee.id, date, {
    tax_id: "12345678Z",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  const simplifiedCode = await collectAndReadCode(page);

  await page.getByTestId("invoice-full").click();
  await expect(page.getByTestId("invoice-full-name")).toHaveValue(
    appointment.patientName,
  );
  await expect(page.getByTestId("invoice-full-tax-id")).toHaveValue(
    "12345678Z",
  );
  await expect(page.getByTestId("invoice-full-address")).toHaveValue(
    "Calle de la Factura 7",
  );
  await page.getByTestId("invoice-full-postal-code").fill("46800");
  await page.getByTestId("invoice-full-city").fill("Xàtiva");
  await page.getByTestId("invoice-full-tax-id").fill("12345678A");
  await page.getByTestId("invoice-full-submit").click();
  await expect(page.getByTestId("invoice-full-error")).toHaveText(
    "Escribe un DNI, NIE o CIF válido. Otros documentos (pasaporte, NIF extranjero) no se admiten todavía.",
  );
  expect(await invoicesOf(appointment.id)).toHaveLength(1);

  await page.getByTestId("invoice-full-tax-id").fill("12345678Z");
  await page.getByTestId("invoice-full-submit").click();
  await expect(page.getByTestId("invoice-code")).not.toHaveText(
    `Factura ${simplifiedCode}`,
  );
  await expect(page.getByTestId("invoice-full")).toHaveCount(0);

  const invoices = await invoicesOf(appointment.id);
  expect(invoices).toHaveLength(2);
  expect(invoices[0]).toMatchObject({
    code: simplifiedCode,
    kind: "simplified",
    status: "replaced",
  });
  expect(invoices[1]).toMatchObject({ kind: "full", status: "issued" });
  expect(invoices[1]?.code).not.toBe(simplifiedCode);
  await expect(page.getByTestId("invoice-code")).toHaveText(
    `Factura ${invoices[1]?.code}`,
  );
});

test("al pasar a otra cita, el formulario de factura completa se cierra y no arrastra los datos de la anterior", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Cambio Cita");
  const first = await createAppointment(
    employee.id,
    date,
    { tax_id: "12345678Z" },
    10,
  );
  const second = await createAppointment(
    employee.id,
    date,
    { tax_id: "X1234567L" },
    12,
  );

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, second.id);
  await collectAndReadCode(page);
  await openAppointment(page, date, first.id);
  await collectAndReadCode(page);

  await page.getByTestId("invoice-full").click();
  await expect(page.getByTestId("invoice-full-name")).toHaveValue(
    first.patientName,
  );

  await page
    .locator(
      `[data-testid="appointment-block"][data-appointment="${second.id}"]`,
    )
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`appointment=${second.id}`));
  await expect(page.getByTestId("invoice-full-form")).toHaveCount(0);

  await page.getByTestId("invoice-full").click();
  await expect(page.getByTestId("invoice-full-name")).toHaveValue(
    second.patientName,
  );
  await expect(page.getByTestId("invoice-full-tax-id")).toHaveValue(
    "X1234567L",
  );
});

test("anular un cobro facturado emite la rectificativa y deja el cobro anulado", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Rectificativa");
  const appointment = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  await collectAndReadCode(page);

  await page.getByTestId("payment-void").click();
  await expect(page.getByTestId("payment-void-confirm")).toHaveText(
    "Emitir rectificativa y anular cobro",
  );
  await page.getByTestId("payment-void-reason").fill("Cobrado por error");
  await page.getByTestId("payment-void-confirm").click();

  await expect(page.getByTestId("appointment-payment-status")).toHaveText(
    "Pendiente de cobro",
  );
  await expect(page.getByTestId("invoice-code")).toHaveCount(0);

  const invoices = await invoicesOf(appointment.id);
  const yy = todayInMadrid().slice(2, 4);
  expect(invoices).toHaveLength(2);
  expect(invoices[1]).toMatchObject({ kind: "rectifying", status: "issued" });
  expect(invoices[1]?.code).toMatch(new RegExp(`^R\\d+/${yy}$`));
  const { data: payment, error } = await admin
    .from("payments")
    .select("voided_at, void_reason")
    .eq("appointment_id", appointment.id)
    .single();
  expect(error).toBeNull();
  expect(payment?.voided_at).not.toBeNull();
  expect(payment?.void_reason).toBe("Cobrado por error");
});

test("una profesional no puede abrir el PDF de la factura de una compañera", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Factura Propia");
  const colleague = await createEmployee("Compañera Factura Ajena");
  const appointment = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  await collectAndReadCode(page);
  const [invoice] = await invoicesOf(appointment.id);
  await logOut(page);
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, DASHBOARD, colleague.email, colleague.password);
  const response = await page.request.get(
    `${DASHBOARD}/facturas/${invoice!.id}/pdf`,
  );
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).not.toBe("application/pdf");
});

test("el listado de facturas filtra por tipo, texto y profesional, cada profesional ve solo las suyas y la propietaria las ve todas", async ({
  page,
}) => {
  const date = todayInMadrid();
  const employeeOne = await createEmployee("Profesional Lista Factura Uno");
  const employeeTwo = await createEmployee("Profesional Lista Factura Dos");
  const appointmentOne = await createAppointment(employeeOne.id, date);
  const appointmentTwo = await createAppointment(employeeTwo.id, date);

  await signIn(page, DASHBOARD, employeeOne.email, employeeOne.password);
  await openAppointment(page, date, appointmentOne.id);
  const codeOne = await collectAndReadCode(page);
  await logOut(page);

  await signIn(page, DASHBOARD, employeeTwo.email, employeeTwo.password);
  await openAppointment(page, date, appointmentTwo.id);
  await collectAndReadCode(page);

  await page.goto(`${DASHBOARD}/facturas`);
  await expect(page.getByTestId("invoices-list")).toBeVisible();
  await expect(
    page
      .getByTestId("invoice-row")
      .filter({ hasText: appointmentTwo.patientName }),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("invoice-row")
      .filter({ hasText: appointmentOne.patientName }),
  ).toHaveCount(0);
  await expect(page.getByTestId("invoices-professional")).toHaveCount(0);
  await logOut(page);

  await signIn(page, DASHBOARD, "info@clinicalumia.es");
  await page.goto(`${DASHBOARD}/facturas`);
  const rowOne = page
    .getByTestId("invoice-row")
    .filter({ hasText: appointmentOne.patientName });
  const rowTwo = page
    .getByTestId("invoice-row")
    .filter({ hasText: appointmentTwo.patientName });

  await page.getByTestId("invoices-professional").selectOption(employeeTwo.id);
  await expect(rowTwo).toHaveCount(1);
  await expect(rowOne).toHaveCount(0);

  await page.getByTestId("invoices-professional").selectOption(employeeOne.id);
  await expect(rowOne).toHaveCount(1);
  await expect(rowTwo).toHaveCount(0);
  await expect(page.getByTestId("invoice-row")).toHaveCount(1);

  await page.getByTestId("invoices-kind").selectOption("simplified");
  await expect(rowOne).toHaveCount(1);
  await page.getByTestId("invoices-kind").selectOption("rectifying");
  await expect(rowOne).toHaveCount(0);
  await page.getByTestId("invoices-kind").selectOption("");
  await expect(rowOne).toHaveCount(1);

  await page.getByTestId("invoices-professional").selectOption("");
  await page.getByTestId("invoices-search").fill(appointmentOne.patientName);
  await expect(rowOne).toHaveCount(1);
  await expect(rowTwo).toHaveCount(0);
  await page.getByTestId("invoices-search").fill(appointmentTwo.patientName);
  await expect(rowTwo).toHaveCount(1);
  await expect(rowOne).toHaveCount(0);
  await page.getByTestId("invoices-search").fill(appointmentOne.patientName);
  await expect(rowTwo).toHaveCount(0);
  await expect(rowOne).toHaveCount(1);
  await rowOne.getByTestId("invoice-open").click();
  await expect(page).toHaveURL(/\/facturas\/[0-9a-f-]+$/);
  await expect(page.getByTestId("invoice-code")).toHaveText(
    `Factura ${codeOne}`,
  );
  await expect(page.getByTestId("invoice-status")).toHaveText("Emitida");
  await expect(page.getByTestId("invoice-view")).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(page.getByTestId("invoice-send")).toBeVisible();
  await expect(page.getByTestId("invoice-full")).toBeVisible();

  const patientId = await patientIdOf(appointmentOne.id);
  await page.goto(`${DASHBOARD}/patients/${patientId}`);
  await expect(page.getByTestId("patient-invoices")).toBeVisible();
  await expect(
    page.getByTestId("patient-invoice").filter({ hasText: codeOne }),
  ).toHaveCount(1);
});

test("una página de facturas más allá del final avisa y enlaza a la primera", async ({
  page,
}) => {
  const date = todayInMadrid();
  const employee = await createEmployee("Profesional Factura Sin Más");
  const appointment = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  await collectAndReadCode(page);

  await page.goto(`${DASHBOARD}/facturas?pagina=2`);
  await expect(page.getByTestId("invoices-empty-page")).toBeVisible();
  await page.getByTestId("invoices-back-to-first").click();
  await expect(page.getByTestId("invoices-list")).toBeVisible();
});

test("desde el detalle se puede emitir la factura completa, y la relación entre ambas facturas queda enlazada en los dos sentidos", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Detalle Factura");
  const appointment = await createAppointment(employee.id, date, {
    tax_id: "12345678Z",
  });

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  const simplifiedCode = await collectAndReadCode(page);
  const [invoice] = await invoicesOf(appointment.id);

  await page.goto(`${DASHBOARD}/facturas/${invoice!.id}`);
  await expect(page.getByTestId("invoice-code")).toHaveText(
    `Factura ${simplifiedCode}`,
  );
  await page.getByTestId("invoice-full").click();
  await page.getByTestId("invoice-full-postal-code").fill("46800");
  await page.getByTestId("invoice-full-city").fill("Xàtiva");
  await page.getByTestId("invoice-full-submit").click();

  await expect(page.getByTestId("invoice-status")).toContainText(
    "Sustituida por",
  );
  await expect(page.getByTestId("invoice-full")).toHaveCount(0);
  const relatedLink = page.getByTestId("invoice-related-link");
  await expect(relatedLink).toContainText(`Sustituida por`);

  await expect(page.getByTestId("invoice-rectify")).toHaveCount(0);

  await relatedLink.click();
  await expect(page.getByTestId("invoice-status")).toHaveText("Emitida");
  await expect(
    page.getByTestId("invoice-related-link").filter({ hasText: "Sustituye a" }),
  ).toContainText(simplifiedCode);
  await expect(page.getByTestId("invoice-rectify")).toBeVisible();
});

test("desde el detalle, quien cobró hoy puede emitir la rectificativa de la factura vigente, y la simplificada rectificada ya no ofrece factura completa", async ({
  page,
}) => {
  const date = addDays(todayInMadrid(), -2);
  const employee = await createEmployee("Profesional Rectifica Detalle");
  const appointment = await createAppointment(employee.id, date);

  await signIn(page, DASHBOARD, employee.email, employee.password);
  await openAppointment(page, date, appointment.id);
  await collectAndReadCode(page);
  const [invoice] = await invoicesOf(appointment.id);

  await page.goto(`${DASHBOARD}/facturas/${invoice!.id}`);
  await expect(page.getByTestId("invoice-full")).toBeVisible();
  await expect(page.getByTestId("invoice-rectify")).toHaveText(
    "Emitir rectificativa",
  );
  await page.getByTestId("invoice-rectify").click();
  await page.getByTestId("payment-void-reason").fill("Importe equivocado");
  await page.getByTestId("payment-void-confirm").click();

  await expect(page.getByTestId("invoice-status")).toContainText(
    "Rectificada por R",
  );
  await expect(page.getByTestId("invoice-rectify")).toHaveCount(0);
  await expect(page.getByTestId("invoice-full")).toHaveCount(0);

  const invoices = await invoicesOf(appointment.id);
  expect(invoices.map((row) => row.kind)).toEqual(["simplified", "rectifying"]);
  await page.goto(`${DASHBOARD}/facturas/${invoices[1]!.id}`);
  await expect(page.getByTestId("invoice-rectify")).toHaveCount(0);
});
