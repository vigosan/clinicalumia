import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  DEV_TOTP_SECRET,
  signIn,
  submitTotpCode,
  totpCode,
  waitForNextTotpWindow,
} from "./auth";
import { latestLinkFor } from "./mail";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1] ?? "";
const anonKey = env.match(/^ANON_KEY="?([^"\n]+)/m)?.[1] ?? "";
const API_URL = "http://127.0.0.1:54321";

const admin = createClient(API_URL, serviceKey);
const createdUserIds: string[] = [];

test.afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

async function createEmployee() {
  const email = `empleado-2fa-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
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
    full_name: "Empleada de prueba",
    role: "employee",
  });
  expect(profileError).toBeNull();

  return { email, password };
}

async function loginToChallenge(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("totp-code").waitFor({ state: "visible" });
}

test("a wrong six-digit code shows the error and keeps you at the challenge", async ({
  page,
}) => {
  const { email, password } = await createEmployee();
  await signIn(page, "http://localhost:3001", email, password);
  await page.getByTestId("logout").click();

  await loginToChallenge(page, email, password);
  await page.getByTestId("totp-code").fill("000000");
  await page.getByTestId("totp-submit").click();

  await expect(page.getByTestId("totp-error")).toContainText("no es correcto");
  await expect(page).toHaveURL(/\/auth\/dos-pasos$/);
});

test("recovering a password with a factor already active asks for the code before the new password, and the new password works", async ({
  page,
}) => {
  const { email, password } = await createEmployee();
  const secret = await signIn(page, "http://localhost:3001", email, password);
  expect(secret).toBeTruthy();
  await page.getByTestId("logout").click();

  await page.goto("/login");
  await page
    .getByRole("link", { name: "¿Has olvidado tu contraseña?" })
    .click();
  await page.getByTestId("recover-email").fill(email);
  await page.getByTestId("recover-submit").click();
  await expect(page.getByTestId("recover-sent")).toBeVisible();

  const link = await latestLinkFor(email, "/auth/confirm");
  await page.goto(link);

  await expect(page.getByTestId("totp-code")).toBeVisible();
  await expect(page.locator('[name="password"]')).toHaveCount(0);

  await submitTotpCode(page, secret!);

  await expect(page).toHaveURL(/\/auth\/contrasena$/);
  const newPassword = "lumia-recuperada-2026";
  await page.fill('[name="password"]', newPassword);
  await page.fill('[name="confirmation"]', newPassword);
  await page.getByTestId("password-submit").click();
  await expect(page.getByTestId("logout")).toBeVisible();

  await page.getByTestId("logout").click();
  await loginToChallenge(page, email, newPassword);
  await submitTotpCode(page, secret!);
  await expect(page.getByTestId("logout")).toBeVisible();
});

test("an open redirect on the challenge's next lands you at this app's home", async ({
  page,
}) => {
  await loginToChallenge(
    page,
    "psicologia@lumia.test",
    "lumia-desarrollo-2026",
  );
  await page.goto("/auth/dos-pasos?next=//evil.com");
  await submitTotpCode(page, DEV_TOTP_SECRET);

  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.getByTestId("logout")).toBeVisible();
});

test("a session that only passed the password sees no specialties until it passes the code", async () => {
  const supabase = createClient(API_URL, anonKey);
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: "psicologia@lumia.test",
      password: "lumia-desarrollo-2026",
    });
  expect(signInError).toBeNull();
  const aal1Token = signInData.session!.access_token;

  const beforeCode = await fetch(`${API_URL}/rest/v1/specialties?select=id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${aal1Token}` },
  }).then((response) => response.json());
  expect(beforeCode).toEqual([]);

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factor = factorsData?.totp.find((f) => f.status === "verified");
  expect(factor).toBeTruthy();
  let { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor!.id,
    code: totpCode(DEV_TOTP_SECRET),
  });
  if (verifyError) {
    await waitForNextTotpWindow(DEV_TOTP_SECRET);
    ({ error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totpCode(DEV_TOTP_SECRET),
    }));
  }
  expect(verifyError).toBeNull();

  const { data: sessionData } = await supabase.auth.getSession();
  const aal2Token = sessionData.session!.access_token;

  const afterCode = await fetch(`${API_URL}/rest/v1/specialties?select=id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${aal2Token}` },
  }).then((response) => response.json());
  expect(afterCode.length).toBeGreaterThan(0);
});
