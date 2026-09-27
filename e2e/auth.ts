import { expect, type Page } from "@playwright/test";
import { TOTP } from "otpauth";

export const DEV_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

export function totpCode(secret: string): string {
  return new TOTP({ secret }).generate();
}

async function waitForNextTotpWindow(secret: string) {
  const remaining = new TOTP({ secret }).remaining();
  await new Promise((resolve) => setTimeout(resolve, remaining + 500));
}

async function submitTotpCode(page: Page, secret: string) {
  const submitButton = page.getByTestId("totp-submit");
  await page.getByTestId("totp-code").fill(totpCode(secret));
  await submitButton.click();

  const rejected = await page
    .getByTestId("totp-error")
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (rejected) {
    await waitForNextTotpWindow(secret);
    await page.getByTestId("totp-code").fill(totpCode(secret));
    await page.getByTestId("totp-submit").click();
    await submitButton.waitFor({ state: "detached", timeout: 15000 });
    return;
  }

  await submitButton.waitFor({ state: "detached", timeout: 15000 });
}

export async function completeTwoFactorStep(
  page: Page,
): Promise<string | undefined> {
  const screen = await Promise.race([
    page
      .getByTestId("totp-start")
      .waitFor({ state: "visible" })
      .then(() => "activar" as const)
      .catch(() => null),
    page
      .getByTestId("totp-code")
      .waitFor({ state: "visible" })
      .then(() => "challenge" as const)
      .catch(() => null),
  ]);
  if (!screen) {
    throw new Error(
      "No ha aparecido ni totp-start ni totp-code tras iniciar sesión.",
    );
  }

  if (screen === "challenge") {
    await submitTotpCode(page, DEV_TOTP_SECRET);
    return undefined;
  }

  await page.getByTestId("totp-start").click();
  const secret = (await page.getByTestId("totp-secret").textContent())?.trim();
  await submitTotpCode(page, secret ?? DEV_TOTP_SECRET);
  return secret;
}

export async function signIn(
  page: Page,
  baseUrl: string,
  email: string,
  password = "lumia-desarrollo-2026",
): Promise<string | undefined> {
  await page.goto(`${baseUrl}/login`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.getByTestId("login-submit").click();
  const secret = await completeTwoFactorStep(page);

  await expect(page).toHaveURL(
    (url) => !/^\/(login|auth)(\/|$)/.test(url.pathname),
  );
  await expect(page.getByTestId("logout")).toBeVisible();

  return secret;
}
