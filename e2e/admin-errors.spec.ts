import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const createdUserIds: string[] = [];
const createdSpecialtyNames: string[] = [];

test.afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
  for (const name of createdSpecialtyNames.splice(0)) {
    await admin.from("specialties").delete().eq("name", name);
  }
});

test("the admin shows an error when a specialty name is already taken", async ({
  page,
}) => {
  const email = `duena-${Date.now()}@test.local`;
  const password = "lumia-segura-2026";
  const { data, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createUserError).toBeNull();
  expect(data.user).not.toBeNull();
  createdUserIds.push(data.user!.id);

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Dueña de prueba",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();

  await signIn(page, "http://localhost:3002", email, password);
  await expect(page).toHaveURL("http://localhost:3002/");
  await expect(
    page.getByRole("navigation", { name: "Secciones" }),
  ).toBeVisible();

  await page.goto("http://localhost:3002/specialties");

  const nameA = `Prueba A ${Date.now()}`;
  const nameB = `Prueba B ${Date.now()}`;
  createdSpecialtyNames.push(nameA, nameB);

  for (const name of [nameA, nameB]) {
    await page.getByTestId("specialty-new").click();
    await page.getByTestId("specialty-name-input").fill(name);
    await page.getByTestId("specialty-submit").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const rowB = page.getByTestId("specialty-row").filter({ hasText: nameB });
  await expect(rowB).toBeVisible();

  await rowB.getByTestId("specialty-edit").click();
  const drawer = page.getByRole("dialog", { name: "Editar especialidad" });
  await drawer.getByTestId("specialty-rename-input").fill(nameA);
  await drawer.getByTestId("specialty-save").click();

  await expect(drawer.getByTestId("specialty-error")).toContainText(
    "Ya existe una especialidad con ese nombre.",
  );

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await rowB.getByTestId("specialty-edit").click();
  await expect(drawer.getByTestId("specialty-rename-input")).toHaveValue(nameB);
  await expect(drawer.getByTestId("specialty-error")).toHaveCount(0);
});
