import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const createdServiceNames: string[] = [];

async function loginAsSeedOwner(page: Page) {
  await page.goto(`${ADMIN}/login`);
  await page.fill('[name="email"]', "info@clinicalumia.es");
  await page.fill('[name="password"]', "lumia-desarrollo-2026");
  await page.getByTestId("login-submit").click();
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
});

test("the owner creates a service with a deposit and sees it listed with its price", async ({
  page,
}) => {
  await loginAsSeedOwner(page);
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
