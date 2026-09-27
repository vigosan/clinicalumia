import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
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
  await page.getByLabel("Especialidad").selectOption({ label: "Fisioterapia" });
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Duración (minutos)").fill("45");
  await page.getByLabel("Precio").fill("50");
  await page.getByLabel("Se puede reservar desde la web").check();
  await page.getByLabel("Qué se paga al reservar").selectOption("fixed");
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
  await expect(row).toContainText("Señal 10,00 €");
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
    await page
      .getByTestId("schedule-employee")
      .selectOption({ label: "Laura Ejemplo" });
    await expect(page).toHaveURL(`${ADMIN}/schedules?employee=${employeeId}`);
    const saturday = page.getByTestId("schedule-day-6");
    await page.getByTestId("schedule-add-6").click();
    await saturday.getByTestId("schedule-start").last().fill("10:00");
    await saturday.getByTestId("schedule-end").last().fill("12:00");
    await page.getByTestId("schedule-add-6").click();
    await saturday.getByTestId("schedule-start").last().fill("11:00");
    await saturday.getByTestId("schedule-end").last().fill("13:00");
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

test("the owner fixes an invalid tax id, saves the clinic details and uploads the logo shown in the invoice preview", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("clinic_settings")
    .select("*")
    .single();
  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    await page.getByLabel("NIF / CIF").fill("20449989A");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByTestId("clinic-error")).toContainText(
      "El NIF/CIF no es válido",
    );
    await expect(
      page.getByLabel("Razón social o nombre del titular"),
    ).toHaveValue(before!.legal_name);
    await page.getByLabel("NIF / CIF").fill("20449989-e");
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
