import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

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

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Dueña de prueba",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();

  await page.goto("http://localhost:3002/login");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL("http://localhost:3002/");

  await page.goto("http://localhost:3002/specialties");

  const nameA = `Prueba A ${Date.now()}`;
  const nameB = `Prueba B ${Date.now()}`;

  await page.getByTestId("specialty-name-input").fill(nameA);
  await page.getByTestId("specialty-submit").click();
  await expect(
    page.getByTestId("specialty-row").filter({ hasText: nameA }),
  ).toBeVisible();

  await page.getByTestId("specialty-name-input").fill(nameB);
  await page.getByTestId("specialty-submit").click();
  const rowB = page.getByTestId("specialty-row").filter({ hasText: nameB });
  await expect(rowB).toBeVisible();

  await rowB.getByTestId("specialty-edit").click();
  await page.getByTestId("specialty-rename-input").fill(nameA);
  await page.getByTestId("specialty-save").click();

  await expect(page.getByTestId("specialty-error")).toContainText(
    "Ya existe una especialidad con ese nombre.",
  );
});
