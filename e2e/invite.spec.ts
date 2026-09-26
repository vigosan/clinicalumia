import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { latestLinkFor } from "./mail";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const createdUserIds: string[] = [];

test.afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

test("an invited employee sets a password and lands in the dashboard", async ({
  page,
}) => {
  const email = `empleado-${Date.now()}@test.local`;
  const { data, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);
  expect(inviteError).toBeNull();
  expect(data.user).not.toBeNull();
  createdUserIds.push(data.user!.id);

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Empleada de prueba",
    role: "employee",
  });
  expect(profileError).toBeNull();

  await page.goto(await latestLinkFor(email, "/auth/confirm"));
  await page.fill('[name="password"]', "corta");
  await page.fill('[name="confirmation"]', "corta");
  await page.getByTestId("password-submit").click();
  await expect(page.getByTestId("password-error")).toContainText(
    "12 caracteres",
  );
  await expect(page.locator('[name="password"]')).toHaveValue("corta");

  await page.fill('[name="password"]', "lumia-segura-2026");
  await page.fill('[name="confirmation"]', "lumia-segura-2026");
  await page.getByTestId("password-submit").click();
  await expect(
    page.getByRole("heading", { name: /Empleada de prueba/ }),
  ).toBeVisible();
});

test("a used or expired invite link sends you to login with an explanation", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=caducado&type=invite");
  await expect(page).toHaveURL(/\/login\?error=enlace/);
  await expect(page.getByTestId("login-link-expired")).toContainText(
    "ha caducado o ya se usó",
  );
});

test("a spoofed forwarded host does not redirect off-site", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-Host": "evil.example" });
  await page.goto("/auth/confirm?token_hash=caducado&type=invite");
  await expect(page).toHaveURL("http://localhost:3001/login?error=enlace");
});
