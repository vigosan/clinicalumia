import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  addDays,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { unzipSync } from "fflate";
import { signIn } from "./auth";
import {
  collectAsStaff,
  deleteInvoicesOfAppointments,
  moveInvoicesOfAppointmentsTo,
  rectifyAsStaff,
  replaceWithFullInvoiceAsStaff,
} from "./invoices";
import { selectOption } from "./select";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const ADMIN = "http://localhost:3002";
const DASHBOARD = "http://localhost:3001";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const EXEMPT_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";
const VAT_21_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b2";

const createdAppointmentIds: string[] = [];
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];
const exportFolders: string[] = [];

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createStaff(role: "owner" | "employee") {
  const email = `trimestre-${role}-${uniqueSuffix()}@test.local`;
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
    full_name:
      role === "owner" ? "Propietaria Trimestre" : "Empleada Trimestre",
    role,
    specialty_id: role === "employee" ? PSICOLOGIA_SPECIALTY_ID : null,
    is_active: true,
  });
  expect(profileError).toBeNull();
  return { id: data.user!.id, email, password };
}

async function createAppointment(
  professionalId: string,
  serviceId: string,
  hour: number,
) {
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: `Trimestre${uniqueSuffix()}`,
      birth_date: "1990-05-12",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  createdPersonIds.push(person!.id);
  const date = addDays(todayInMadrid(), -1);
  const { data, error } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      patient_id: person!.id,
      service_id: serviceId,
      starts_at: `${date} ${hour}:00:00 Europe/Madrid`,
      ends_at: `${date} ${hour + 1}:00:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdAppointmentIds.push(data!.id);
  return data!.id as string;
}

async function invoicesOf(appointmentIds: string[]) {
  const { data, error } = await admin
    .from("invoices")
    .select("code, kind, issued_at, payments!inner(appointment_id)")
    .in("payments.appointment_id", appointmentIds);
  expect(error).toBeNull();
  return data ?? [];
}

async function emptyPastQuarter(): Promise<{ year: number; q: number }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const year = 2001 + Math.floor(Math.random() * 19);
    const q = 1 + Math.floor(Math.random() * 4);
    const month = (start: number) => String(start).padStart(2, "0");
    const from = madridInstant(`${year}-${month(3 * q - 2)}-01`, "00:00");
    const to =
      q === 4
        ? madridInstant(`${year + 1}-01-01`, "00:00")
        : madridInstant(`${year}-${month(3 * q + 1)}-01`, "00:00");
    const { count, error } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .gte("issued_at", from)
      .lt("issued_at", to);
    expect(error).toBeNull();
    if (count === 0) return { year, q };
  }
  throw new Error("No hay ningún trimestre pasado libre para la prueba");
}

async function quarterWithFiveInvoices() {
  const { year, q } = await emptyPastQuarter();
  const employee = await createStaff("employee");
  const replaced = await createAppointment(employee.id, EXEMPT_SERVICE_ID, 9);
  const rectified = await createAppointment(employee.id, VAT_21_SERVICE_ID, 11);
  const kept = await createAppointment(employee.id, VAT_21_SERVICE_ID, 13);
  collectAsStaff(employee.id, replaced, 5500);
  replaceWithFullInvoiceAsStaff(employee.id, replaced, {
    name: "Empresa Cliente",
    taxId: "12345678Z",
  });
  collectAsStaff(employee.id, rectified, 9000);
  rectifyAsStaff(employee.id, rectified);
  collectAsStaff(employee.id, kept, 9000);
  const appointmentIds = [replaced, rectified, kept];
  moveInvoicesOfAppointmentsTo(appointmentIds, year, 3 * q - 2);
  const invoices = await invoicesOf(appointmentIds);
  expect(invoices).toHaveLength(5);
  return { year, q, invoices };
}

async function exportsOf(folder: string) {
  const { data, error } = await admin.storage.from("exports").list(folder);
  expect(error).toBeNull();
  return (data ?? []).map(({ name }) => name);
}

async function openQuarter(page: Page, year: number, q: number) {
  await page.goto(`${ADMIN}/facturacion?year=${year}&q=${q}`);
  await expect(
    page.getByRole("heading", { name: "Facturación" }),
  ).toBeVisible();
}

test.afterEach(async () => {
  const errors: unknown[] = [];
  for (const folder of exportFolders.splice(0)) {
    const names = await exportsOf(folder);
    if (names.length === 0) continue;
    const { error } = await admin.storage
      .from("exports")
      .remove(names.map((name) => `${folder}/${name}`));
    if (error) errors.push(error);
  }
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

test("la propietaria revisa un trimestre y descarga el libro de facturas con los mismos totales", async ({
  page,
}) => {
  const { year, q, invoices } = await quarterWithFiveInvoices();
  const owner = await createStaff("owner");
  await signIn(page, ADMIN, owner.email, owner.password);

  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Facturación" })
    .click();
  await expect(page).toHaveURL(`${ADMIN}/facturacion`);
  const today = todayInMadrid();
  const currentYear = Number(today.slice(0, 4));
  const currentQ = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const closedYear = currentQ === 1 ? currentYear - 1 : currentYear;
  const closedQ = currentQ === 1 ? 4 : currentQ - 1;
  await expect(page.getByTestId("quarter-year")).toHaveText(String(closedYear));
  await expect(page.getByTestId("quarter-q")).toContainText(`T${closedQ} ·`);

  await openQuarter(page, year, q);
  await expect(page.getByTestId("quarter-current")).toHaveCount(0);
  await expect(page.getByTestId("quarter-count-simplified")).toHaveText("2");
  await expect(page.getByTestId("quarter-count-full")).toHaveText("1");
  await expect(page.getByTestId("quarter-count-rectifying")).toHaveText("1");
  await expect(page.getByTestId("quarter-count-replaced")).toHaveText("1");
  await expect(page.getByTestId("quarter-vat-0")).toContainText(
    /Exento.*55,00 €.*0,00 €.*55,00 €/s,
  );
  await expect(page.getByTestId("quarter-vat-21")).toContainText(
    /IVA 21 %.*74,38 €.*15,62 €.*90,00 €/s,
  );
  await expect(page.getByTestId("quarter-net")).toHaveText("145,00 €");

  const downloading = page.waitForEvent("download");
  await page.getByTestId("quarter-download-xlsx").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(
    `LUMIA-facturas-${year}-T${q}.xlsx`,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);

  const ledger = workbook.getWorksheet("Facturas")!;
  expect(ledger.rowCount).toBe(6);
  const codes: unknown[] = [];
  let ledgerTotal = 0;
  ledger.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    codes.push(row.getCell(2).value);
    expect(row.getCell(13).value).toBe(
      row.getCell(3).value === "Completa" ? "No" : "Sí",
    );
    if (row.getCell(13).value === "Sí")
      ledgerTotal += row.getCell(12).value as number;
  });
  expect(codes.sort()).toEqual(invoices.map((invoice) => invoice.code).sort());
  expect(ledgerTotal).toBeCloseTo(145, 2);

  const summary = workbook.getWorksheet("Resumen")!;
  let net: unknown;
  summary.eachRow((row) => {
    if (row.getCell(1).value === "Total neto") net = row.getCell(4).value;
  });
  expect(net).toBe(145);

  await selectOption(page.getByTestId("quarter-q"), String((q % 4) + 1));
  await expect(page).toHaveURL(
    `${ADMIN}/facturacion?year=${year}&q=${(q % 4) + 1}`,
  );
  await expect(page.getByTestId("quarter-empty")).toBeVisible();
  await expect(page.getByTestId("quarter-download-xlsx")).toHaveCount(0);

  await openQuarter(page, currentYear, currentQ);
  await expect(page.getByTestId("quarter-current")).toHaveText(
    "Trimestre en curso: los datos pueden cambiar.",
  );

  for (const search of ["?year=2026&q=5", "?year=26&q=1", ""]) {
    const response = await page.request.get(
      `${ADMIN}/facturacion/excel${search}`,
    );
    expect(response.status()).toBe(400);
    expect(await response.text()).toBe("El año o el trimestre no son válidos.");
  }
});

test("una empleada no puede ver la facturación ni descargar el libro", async ({
  page,
}) => {
  const employee = await createStaff("employee");
  await signIn(page, DASHBOARD, employee.email, employee.password);

  const response = await page.request.get(
    `${ADMIN}/facturacion/excel?year=2026&q=3`,
  );
  expect(response.status()).toBe(403);
  expect(response.headers()["content-disposition"]).toBeUndefined();

  await page.goto(`${ADMIN}/facturacion?year=2026&q=3`);
  await expect(page).toHaveURL(`${ADMIN}/login`);
  await expect(page.getByTestId("quarter-net")).toHaveCount(0);
});

test("la propietaria descarga en un ZIP un PDF por factura del trimestre y el libro, y solo se guarda el último ZIP", async ({
  page,
}) => {
  const { year, q, invoices } = await quarterWithFiveInvoices();
  const owner = await createStaff("owner");
  exportFolders.push(owner.id);
  await signIn(page, ADMIN, owner.email, owner.password);
  await openQuarter(page, year, q);

  const downloading = page.waitForEvent("download");
  await page.getByTestId("quarter-download-zip").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`LUMIA-facturas-${year}-T${q}.zip`);
  const entries = unzipSync(await readFile((await download.path())!));
  const pdfs = Object.keys(entries).filter((name) => name.endsWith(".pdf"));
  expect(pdfs.sort()).toEqual(
    invoices.map(({ code }) => `${code.replaceAll("/", "-")}.pdf`).sort(),
  );
  expect(pdfs.some((name) => name.startsWith("R"))).toBe(true);
  for (const name of pdfs) {
    expect(new TextDecoder().decode(entries[name]!.slice(0, 4))).toBe("%PDF");
  }
  const xlsx = entries[`LUMIA-facturas-${year}-T${q}.xlsx`];
  expect(xlsx).toBeDefined();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(xlsx!));
  expect(workbook.getWorksheet("Facturas")!.rowCount).toBe(invoices.length + 1);
  await expect(page.getByTestId("quarter-download-zip")).toHaveText(
    "Descargar PDF (ZIP)",
  );
  await expect(page.getByTestId("quarter-zip-error")).toHaveCount(0);

  const [first] = await exportsOf(owner.id);
  expect(await exportsOf(owner.id)).toHaveLength(1);

  const again = await page.request.post(
    `${ADMIN}/facturacion/zip?year=${year}&q=${q}`,
  );
  expect(again.status()).toBe(200);
  const { url } = (await again.json()) as { url: string };
  const stored = await exportsOf(owner.id);
  expect(stored).toHaveLength(1);
  expect(stored[0]).not.toBe(first);
  const fetched = await page.request.get(url);
  expect(fetched.status()).toBe(200);
  expect(fetched.headers()["content-disposition"]).toContain(
    `LUMIA-facturas-${year}-T${q}.zip`,
  );

  const empty = await page.request.post(
    `${ADMIN}/facturacion/zip?year=${year}&q=${(q % 4) + 1}`,
  );
  expect(empty.status()).toBe(404);
  expect(await empty.json()).toEqual({
    error: "No hay facturas en este trimestre.",
  });
  expect(await exportsOf(owner.id)).toEqual(stored);
});

test("el ZIP del trimestre avisa de que se está preparando y explica el fallo sin dejar el botón bloqueado", async ({
  page,
}) => {
  const { year, q } = await quarterWithFiveInvoices();
  const owner = await createStaff("owner");
  exportFolders.push(owner.id);
  await signIn(page, ADMIN, owner.email, owner.password);
  await openQuarter(page, year, q);

  let answer = () => {};
  const answered = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route("**/facturacion/zip?*", async (route) => {
    await answered;
    await route.fulfill({
      status: 413,
      json: {
        error:
          "El ZIP del trimestre pesa más de 50 MB. Descarga las facturas desde el panel.",
      },
    });
  });
  await page.getByTestId("quarter-download-zip").click();
  await expect(page.getByTestId("quarter-download-zip")).toHaveText(
    "Preparando…",
  );
  await expect(page.getByTestId("quarter-download-zip")).toBeDisabled();
  answer();
  await expect(page.getByTestId("quarter-zip-error")).toHaveText(
    "El ZIP del trimestre pesa más de 50 MB. Descarga las facturas desde el panel.",
  );
  await expect(page.getByTestId("quarter-download-zip")).toBeEnabled();
  expect(await exportsOf(owner.id)).toEqual([]);
});

test("solo la propietaria puede generar el ZIP del trimestre", async ({
  page,
  request,
}) => {
  const anonymous = await request.post(
    `${ADMIN}/facturacion/zip?year=2026&q=3`,
    { maxRedirects: 0 },
  );
  expect(anonymous.status()).toBe(307);
  expect(new URL(anonymous.headers().location!, ADMIN).pathname).toBe("/login");

  const employee = await createStaff("employee");
  exportFolders.push(employee.id);
  await signIn(page, DASHBOARD, employee.email, employee.password);
  const response = await page.request.post(
    `${ADMIN}/facturacion/zip?year=2026&q=3`,
  );
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({
    error: "No tienes permiso para hacer esto.",
  });
  expect(await exportsOf(employee.id)).toEqual([]);
});
