import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";

async function loginAsOwner(page: import("@playwright/test").Page) {
  const email = `owner-ui-${Date.now()}@test.local`;
  const password = "lumia-segura-2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Propietaria UI",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await page.goto(`${ADMIN}/login`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.getByTestId("login-submit").click();
  await expect(
    page.getByRole("navigation", { name: "Secciones" }),
  ).toBeVisible();
}

test("deleting a specialty asks for confirmation and only deletes after confirming", async ({
  page,
}) => {
  await loginAsOwner(page);
  const name = `Borrar ${Date.now()}`;
  await page.goto(`${ADMIN}/specialties`);
  await page.getByTestId("specialty-name-input").fill(name);
  await page.getByTestId("specialty-submit").click();
  const row = page.getByTestId("specialty-row").filter({ hasText: name });
  await row.getByTestId("specialty-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();
  await row.getByTestId("specialty-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(row).toHaveCount(0);
});

test("deactivating a team member asks for confirmation, and reactivating is immediate", async ({
  page,
}) => {
  await loginAsOwner(page);
  const fullName = `Empleada UI ${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `member-ui-${Date.now()}@test.local`,
    password: "lumia-segura-2026",
    email_confirm: true,
  });
  expect(error).toBeNull();
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email: data.user!.email,
    full_name: fullName,
    role: "employee",
    is_active: true,
  });
  expect(profileError).toBeNull();

  await page.goto(`${ADMIN}/team`);
  const row = page.getByRole("listitem").filter({ hasText: fullName });
  await row.getByRole("button", { name: "Desactivar" }).click();
  await expect(
    page.getByRole("alertdialog", { name: `¿Desactivar a ${fullName}?` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(row.getByRole("button", { name: "Desactivar" })).toBeVisible();

  await row.getByRole("button", { name: "Desactivar" }).click();
  await page.getByTestId("confirm-action").click();
  await expect(row.getByTestId("member-status")).toBeVisible();

  await row.getByRole("button", { name: "Activar" }).click();
  await expect(row.getByTestId("member-status")).toHaveCount(0);
});

test("the section menu marks the current page and stays usable on a phone", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/team`);
  const nav = page.getByRole("navigation", { name: "Secciones" });
  await expect(nav.getByRole("link", { name: "Equipo" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole("link", { name: "Especialidades" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
