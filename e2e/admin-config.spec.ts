import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { pickTime } from "./date-time";
import {
  deleteInvoiceSeries,
  lockNextYearInvoiceSeries,
  madridYear,
} from "./invoices";
import { selectOption } from "./select";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const FISIOTERAPIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001c";
const createdServiceNames: string[] = [];
const createdUserIds: string[] = [];

async function loginAsOwner(page: Page) {
  const email = `owner-config-${Date.now()}@test.local`;
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
    full_name: "Propietaria de prueba",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await signIn(page, ADMIN, email, password);
  await expect(
    page.getByRole("navigation", { name: "Secciones" }),
  ).toBeVisible();
  return data.user!.id;
}

async function professionalsWithoutSchedule(): Promise<string[]> {
  const [{ data: professionals }, { data: schedules }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .not("specialty_id", "is", null),
    admin.from("employee_schedules").select("profile_id"),
  ]);
  const scheduled = new Set((schedules ?? []).map((row) => row.profile_id));
  return (professionals ?? [])
    .filter((professional) => !scheduled.has(professional.id))
    .map((professional) => professional.full_name);
}

test.afterEach(async () => {
  if (createdServiceNames.length > 0) {
    await admin
      .from("services")
      .delete()
      .in("name", createdServiceNames.splice(0));
  }
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

test("the owner creates a service with a deposit and sees it listed with its price", async ({
  page,
}) => {
  await loginAsOwner(page);
  const name = `Sesión e2e ${Date.now()}`;
  createdServiceNames.push(name);
  await page.goto(`${ADMIN}/services`);
  await page.getByTestId("service-new").click();
  const isFormValid = () =>
    page
      .getByTestId("service-form")
      .evaluate((form: HTMLFormElement) => form.checkValidity());
  expect(await isFormValid()).toBe(false);
  await selectOption(page.getByLabel("Especialidad", { exact: true }), {
    label: "Fisioterapia",
  });
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Duración (minutos)").fill("45");
  await page.getByLabel("Precio").fill("50");
  await page.getByLabel("Se puede reservar desde la web").check();
  await selectOption(page.getByLabel("Qué se paga al reservar"), "fixed");
  await page.getByLabel("Importe de la señal").fill("60");
  await page.getByTestId("service-submit").click();
  await expect(page.getByTestId("service-error")).toContainText(
    "La señal no puede ser mayor que el precio.",
  );
  await expect(page.getByLabel("Nombre")).toHaveValue(name);
  await page.getByLabel("Importe de la señal").fill("10");
  await page.getByTestId("service-submit").click();
  const row = page.getByTestId("service-row").filter({ hasText: name });
  await expect(row).toContainText("50,00 €");
  await expect(row.getByTestId("service-booking")).toHaveText(
    "Solo por teléfono",
  );
});

test("while online payments are off, the services list says which services can only be booked by phone, with a notice above", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/services`);
  await expect(page.getByTestId("services-phone-only-notice")).toContainText(
    "Los cobros online están desactivados",
  );
  const rowOf = (name: string) =>
    page
      .getByTestId("service-row")
      .filter({ has: page.getByText(name, { exact: true }) });
  await expect(
    rowOf("Psicoterapia individual").getByTestId("service-booking"),
  ).toHaveText("Solo por teléfono");
  await expect(
    rowOf("Sesión de logopedia").getByTestId("service-booking"),
  ).toHaveText("Paga en la clínica");
});

test("the admin home says everything is ready, and once something is missing lists it with a link to where it is fixed", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("clinic_settings")
    .select("tax_id")
    .single();
  try {
    const ownerId = await loginAsOwner(page);
    await page.goto(`${ADMIN}/`);
    await expect(page.getByTestId("pending-clinic-fiscal-warning")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId(`pending-schedule-warning-${ownerId}`),
    ).toHaveCount(0);
    const othersWithoutSchedule = await professionalsWithoutSchedule();
    if (othersWithoutSchedule.length === 0) {
      await expect(page.getByTestId("pending-none")).toHaveText(
        "Todo listo: la clínica puede dar citas, cobrar y facturar.",
      );
      await expect(page.getByTestId("pending-setup")).toHaveCount(0);
    } else {
      test.info().annotations.push({
        type: "skipped «Todo listo»",
        description: `la base compartida tiene profesionales sin horario: ${othersWithoutSchedule.join(", ")}`,
      });
    }

    await admin.from("clinic_settings").update({ tax_id: "" }).eq("id", true);
    await admin
      .from("profiles")
      .update({ specialty_id: FISIOTERAPIA_SPECIALTY_ID })
      .eq("id", ownerId);
    await page.reload();
    await expect(page.getByTestId("pending-none")).toHaveCount(0);
    await expect(page.getByTestId("pending-setup")).toContainText(
      "Pendiente de configurar",
    );
    await expect(
      page.getByTestId(`pending-schedule-warning-${ownerId}`),
    ).toHaveText(
      "Propietaria de prueba no tiene horario semanal: no tendrá huecos en la agenda ni en la web.",
    );
    await page.getByTestId("pending-clinic-fiscal-warning").click();
    await expect(page).toHaveURL(`${ADMIN}/clinic`);
    await page.goto(`${ADMIN}/`);
    await page.getByTestId(`pending-schedule-warning-${ownerId}`).click();
    await expect(page).toHaveURL(`${ADMIN}/schedules?employee=${ownerId}`);
  } finally {
    await admin
      .from("clinic_settings")
      .update({ tax_id: before!.tax_id })
      .eq("id", true);
  }
});

test("the owner edits a weekly schedule, is warned about overlaps, and the change survives a reload", async ({
  page,
}) => {
  const employeeId = "a0000000-0000-0000-0000-000000000002";
  const { data: original } = await admin
    .from("employee_schedules")
    .select("weekday, starts_at, ends_at")
    .eq("profile_id", employeeId);
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/schedules`);
    await expect(page.getByLabel("Persona del equipo")).toBeVisible();
    await expect(page.getByTestId("schedule-employee")).toHaveText(
      "Laura Ejemplo",
    );
    await selectOption(page.getByTestId("schedule-employee"), {
      label: "Marc Ejemplo",
    });
    await expect(page).toHaveURL(
      /\/schedules\?employee=(?!a0000000-0000-0000-0000-000000000002)/,
    );
    await selectOption(page.getByTestId("schedule-employee"), {
      label: "Laura Ejemplo",
    });
    await expect(page).toHaveURL(`${ADMIN}/schedules?employee=${employeeId}`);
    const saturday = page.getByTestId("schedule-day-6");
    await page.getByTestId("schedule-add-6").click();
    await pickTime(saturday.getByTestId("schedule-start").last(), "10:00");
    await pickTime(saturday.getByTestId("schedule-end").last(), "12:00");
    await page.getByTestId("schedule-add-6").click();
    await pickTime(saturday.getByTestId("schedule-start").last(), "11:00");
    await pickTime(saturday.getByTestId("schedule-end").last(), "13:00");
    await page.getByTestId("schedule-save").click();
    await expect(page.getByTestId("schedule-error")).toContainText(
      "El sábado tiene dos tramos que se solapan.",
    );
    await expect(
      saturday.getByLabel("Quitar tramo 2 del sábado"),
    ).toBeVisible();
    await saturday.getByTestId("schedule-remove").last().click();
    await page.getByTestId("schedule-save").click();
    await expect(page.getByTestId("schedule-saved")).toBeVisible();
    await page.reload();
    await expect(
      page.getByTestId("schedule-day-6").getByTestId("schedule-start"),
    ).toHaveValue("10:00");
  } finally {
    await admin
      .from("employee_schedules")
      .delete()
      .eq("profile_id", employeeId);
    if (original?.length) {
      await admin
        .from("employee_schedules")
        .insert(original.map((row) => ({ ...row, profile_id: employeeId })));
    }
  }
});

test("the owner sees the invalid tax id and postal code next to their fields, fixes them, saves the clinic details and uploads the logo shown in the invoice preview", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("clinic_settings")
    .select("*")
    .single();
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    await page.getByLabel("NIF / CIF").fill("12345");
    await page.getByLabel("Código postal").fill("4680");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByLabel("NIF / CIF")).toHaveAccessibleDescription(
      "El NIF/CIF no es válido. Revisa la letra o el dígito de control.",
    );
    await expect(page.getByLabel("NIF / CIF")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("Código postal")).toHaveAccessibleDescription(
      "El código postal debe tener 5 cifras.",
    );
    await expect(page.getByTestId("clinic-error")).toHaveCount(0);
    await expect(
      page.getByLabel("Razón social o nombre del titular"),
    ).toHaveValue(before!.legal_name);
    await page.getByLabel("NIF / CIF").fill("20449989-e");
    await page.getByLabel("Código postal").fill(before!.postal_code);
    await page.getByLabel("Plazo de cancelación gratuita (horas)").fill("48");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByTestId("clinic-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("NIF / CIF")).toHaveValue("20449989E");
    await expect(
      page.getByLabel("Plazo de cancelación gratuita (horas)"),
    ).toHaveValue("48");
    await page.getByTestId("logo-input").setInputFiles("fixtures/logo.png");
    await page.getByTestId("logo-submit").click();
    await expect(
      page.getByTestId("logo-preview").getByRole("img"),
    ).toBeVisible();
    const { data: uploaded } = await admin
      .from("clinic_settings")
      .select("logo_path")
      .single();
    const { data: stored } = await admin.storage
      .from("branding")
      .download(uploaded?.logo_path ?? "");
    const header = new DataView(await (stored as Blob).arrayBuffer());
    expect(header.getUint32(16)).toBe(600);
  } finally {
    const { data: after } = await admin
      .from("clinic_settings")
      .select("logo_path")
      .single();
    if (after?.logo_path && after.logo_path !== before?.logo_path) {
      await admin.storage.from("branding").remove([after.logo_path]);
    }
    await admin
      .from("clinic_settings")
      .update({ ...before, updated_at: undefined })
      .eq("id", true);
  }
});

test("the owner saves the minimum notice and the booking horizon, and they survive a reload", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("clinic_settings")
    .select("*")
    .single();
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    await page.getByLabel("Antelación mínima (horas)").fill("48");
    await page.getByLabel("Hasta cuántos días se puede reservar").fill("90");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByTestId("clinic-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Antelación mínima (horas)")).toHaveValue(
      "48",
    );
    await expect(
      page.getByLabel("Hasta cuántos días se puede reservar"),
    ).toHaveValue("90");
  } finally {
    await admin
      .from("clinic_settings")
      .update({ ...before, updated_at: undefined })
      .eq("id", true);
  }
});

test("a service that can be booked online with a deposit warns it can't take online bookings until payments are enabled", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/services`);
  await page.getByTestId("service-new").click();
  await selectOption(page.getByLabel("Especialidad", { exact: true }), {
    label: "Fisioterapia",
  });
  await page.getByLabel("Se puede reservar desde la web").check();
  await expect(page.getByTestId("service-phone-only-note")).toHaveCount(0);
  await selectOption(page.getByLabel("Qué se paga al reservar"), "fixed");
  await expect(page.getByTestId("service-phone-only-note")).toContainText(
    "No se podrá reservar online hasta activar los cobros.",
  );
  await selectOption(page.getByLabel("Qué se paga al reservar"), "none");
  await expect(page.getByTestId("service-phone-only-note")).toHaveCount(0);
});

test("uploading a logo over 2 MB shows a clear error instead of crashing", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/clinic`);
  await page.getByTestId("logo-input").setInputFiles({
    name: "logo-grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(4 * 1024 * 1024),
  });
  await page.getByTestId("logo-submit").click();
  await expect(page.getByTestId("logo-error")).toHaveText(
    "El logo no puede pesar más de 2 MB.",
  );
  expect(pageErrors).toHaveLength(0);
});

test("the owner picks the numbering of a future year from examples or writes her own, and sees the preview and the saved numbering", async ({
  page,
}) => {
  const year = madridYear() + 5;
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    const currentYear = madridYear();
    for (const listedYear of [currentYear, currentYear + 1]) {
      await expect(
        page.getByTestId(`invoice-series-main-summary-${listedYear}`),
      ).toContainText(`${listedYear}: `);
    }
    const form = page.getByTestId("invoice-series-main-form");
    await form.getByTestId("invoice-series-main-year").fill(String(year));
    await selectOption(form.getByTestId("invoice-series-main-format-choice"), {
      label: "Otro formato",
    });
    await form.getByTestId("invoice-series-main-format").fill("E2E-{n:3}/{aa}");
    await form.getByTestId("invoice-series-main-next-number").fill("7");
    await expect(page.getByTestId("invoice-series-main-preview")).toHaveText(
      `La próxima factura será E2E-007/${String(year).slice(-2)}.`,
    );
    await selectOption(form.getByTestId("invoice-series-main-format-choice"), {
      label: `${year}-0001`,
    });
    await expect(form.getByTestId("invoice-series-main-format")).toHaveCount(0);
    await expect(page.getByTestId("invoice-series-main-preview")).toHaveText(
      `La próxima factura será ${year}-0007.`,
    );
    await form.getByTestId("invoice-series-main-submit").click();
    await expect(page.getByTestId("invoice-series-main-saved")).toBeVisible();
    await selectOption(form.getByTestId("invoice-series-main-format-choice"), {
      label: "Otro formato",
    });
    await form
      .getByTestId("invoice-series-main-year")
      .fill(String(currentYear));
    await expect(form.getByTestId("invoice-series-main-format")).toHaveCount(0);
    await expect(
      form.getByTestId("invoice-series-main-format-choice"),
    ).toContainText(`1/${String(currentYear).slice(-2)}`);
    const { data: saved } = await admin
      .from("invoice_series")
      .select("format, next_number, locked")
      .eq("code", "main")
      .eq("year", year)
      .single();
    expect(saved).toEqual({
      format: "{año}-{n:4}",
      next_number: 7,
      locked: false,
    });
  } finally {
    deleteInvoiceSeries("main", year);
  }
});

test("the owner sees why a format is refused before saving, and a year already in use cannot be edited", async ({
  page,
}) => {
  const year = lockNextYearInvoiceSeries("rectifying", "E2E-L{n}/{aa}");
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    await expect(
      page.getByTestId(`invoice-series-rectifying-summary-${year}`),
    ).toHaveText(`${year}: próxima E2E-L6/${String(year).slice(-2)} · en uso`);

    const main = page.getByTestId("invoice-series-main-form");
    await main.getByTestId("invoice-series-main-year").fill(String(year + 4));
    await selectOption(main.getByTestId("invoice-series-main-format-choice"), {
      label: "Otro formato",
    });
    await main.getByTestId("invoice-series-main-format").fill("F-{n}");
    await expect(page.getByTestId("invoice-series-main-preview")).toHaveText(
      "Falta el año ({aa} o {año}).",
    );
    await expect(main.getByTestId("invoice-series-main-submit")).toBeDisabled();
    await main.getByTestId("invoice-series-main-format").fill("E2E-L{n}/{aa}");
    await expect(page.getByTestId("invoice-series-main-preview")).toHaveText(
      "Da los mismos códigos que la otra serie. Usa una letra que las distinga, como R{n}/{aa}.",
    );
    await expect(main.getByTestId("invoice-series-main-submit")).toBeDisabled();

    const rectifying = page.getByTestId("invoice-series-rectifying-form");
    await rectifying
      .getByTestId("invoice-series-rectifying-year")
      .fill(String(year));
    await expect(
      page.getByTestId("invoice-series-rectifying-locked"),
    ).toHaveText(
      `La numeración de ${year} ya está en uso y no se puede cambiar.`,
    );
    await expect(
      rectifying.getByTestId("invoice-series-rectifying-format"),
    ).toBeDisabled();
    await expect(
      rectifying.getByTestId("invoice-series-rectifying-next-number"),
    ).toBeDisabled();
    await expect(
      rectifying.getByTestId("invoice-series-rectifying-submit"),
    ).toBeDisabled();
  } finally {
    deleteInvoiceSeries("rectifying", year);
  }
});
