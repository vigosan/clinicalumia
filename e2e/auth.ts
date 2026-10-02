import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { TOTP } from "otpauth";

export const DEV_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const SIGN_IN_LOCK_TIMEOUT_MS = 180_000;
const SIGN_IN_LOCK_STALE_MS = 120_000;
const SIGN_IN_LOCK_POLL_MS = 100;

async function acquireSignInLock(email: string): Promise<() => void> {
  const lockPath = path.join(os.tmpdir(), `lumia-e2e-signin-${email}.lock`);
  const deadline = Date.now() + SIGN_IN_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      fs.closeSync(fs.openSync(lockPath, "wx"));
      return () => fs.rmSync(lockPath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      const stale = fs.statSync(lockPath, { throwIfNoEntry: false });
      if (stale && Date.now() - stale.mtimeMs > SIGN_IN_LOCK_STALE_MS) {
        fs.rmSync(lockPath, { force: true });
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Tiempo agotado esperando el bloqueo de inicio de sesión de ${email}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, SIGN_IN_LOCK_POLL_MS));
    }
  }
}

export function totpCode(secret: string): string {
  return new TOTP({ secret }).generate();
}

export async function waitForNextTotpWindow(secret: string) {
  const remaining = new TOTP({ secret }).remaining();
  await new Promise((resolve) => setTimeout(resolve, remaining + 500));
}

export async function submitTotpCode(page: Page, secret: string) {
  const submitButton = page.getByTestId("totp-submit");
  await page.getByTestId("totp-code").fill(totpCode(secret));
  await submitButton.click();

  const outcome = await Promise.race([
    page
      .getByTestId("totp-error")
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => "rejected" as const)
      .catch(() => null),
    submitButton
      .waitFor({ state: "detached", timeout: 15000 })
      .then(() => "accepted" as const)
      .catch(() => null),
  ]);
  if (!outcome) {
    throw new Error("El código TOTP no se ha aceptado ni rechazado en 15 s.");
  }

  if (outcome === "rejected") {
    await waitForNextTotpWindow(secret);
    await page.getByTestId("totp-code").fill(totpCode(secret));
    await page.getByTestId("totp-submit").click();
    await submitButton.waitFor({ state: "detached", timeout: 15000 });
  }
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
  const secret = (await page.getByTestId("totp-secret").textContent())?.replace(
    /\s+/g,
    "",
  );
  await submitTotpCode(page, secret ?? DEV_TOTP_SECRET);
  return secret;
}

export async function signIn(
  page: Page,
  baseUrl: string,
  email: string,
  password = "lumia-desarrollo-2026",
): Promise<string | undefined> {
  const releaseLock = await acquireSignInLock(email);
  try {
    await page.goto(`${baseUrl}/login`);
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.getByTestId("login-submit").click();
    const secret = await completeTwoFactorStep(page);

    await expect(page).toHaveURL(
      (url) => !/^\/(login|auth)(\/|$)/.test(url.pathname),
    );
    await expect(page.getByTestId("user-menu")).toBeVisible();

    return secret;
  } finally {
    releaseLock();
  }
}

export async function logOut(page: Page) {
  const panel = page.getByTestId("appointment-panel");
  if (await panel.isVisible()) {
    await panel.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/appointment=/);
  }
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login$/);
}
