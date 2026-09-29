import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { latestCodeFor, latestLinkFor } from "./mail";

const WEB = "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:54324/api/v1";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const usedEmails: string[] = [];
const staffIds: string[] = [];

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${Date.now()}-${randomInt(1e9)}@test.local`;
  usedEmails.push(email);
  return email;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(256)}`,
  });
});

test.afterEach(async () => {
  for (const email of usedEmails.splice(0)) {
    const { data: account } = await admin
      .from("patient_accounts")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (account) await admin.auth.admin.deleteUser(account.id);
    await admin.from("access_requests").delete().eq("email", email);
    await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
      { method: "DELETE" },
    );
  }
  for (const id of staffIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
});

async function requestAccess(page: Page, email: string) {
  await page.goto(`${WEB}/acceder?next=%2Freservar`);
  await page.getByTestId("access-email").fill(email);
  await page.getByTestId("access-submit").click();
}

test("a new patient gets a code by email that opens a session and returns to booking", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-codigo");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toContainText(
    "Te hemos enviado un enlace y un código",
  );

  const { data: account } = await admin
    .from("patient_accounts")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  expect(account).not.toBeNull();

  await page.getByTestId("access-code").fill(await latestCodeFor(email));
  await page.getByTestId("access-code-submit").click();

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("reservar-email")).toHaveText(email);
});

test("the link in the same email also opens the session, for someone reading mail on this device", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-enlace");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toBeVisible();

  await page.goto(await latestLinkFor(email, "/acceder/confirmar"));

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("reservar-email")).toHaveText(email);
});

test("a used or forged link sends the person back to ask for a new one", async ({
  page,
}) => {
  await page.goto(
    `${WEB}/acceder/confirmar?token_hash=caducado&type=email&next=%2Freservar`,
  );

  await expect(page).toHaveURL(`${WEB}/acceder?caducado=1`);
  await expect(page.getByTestId("access-link-expired")).toBeVisible();
});

test("the sixth request in an hour for the same email is stopped, so the web cannot flood an inbox", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-limite");

  for (let attempt = 0; attempt < 5; attempt++) {
    await requestAccess(page, email);
    await expect(page.getByTestId("access-sent")).toBeVisible();
  }
  await requestAccess(page, email);

  await expect(page.getByTestId("access-error")).toHaveText(
    "Demasiados intentos. Espera unos minutos.",
  );
});

test("a team email cannot become a patient account and is sent to the panel", async ({
  page,
}) => {
  const email = uniqueEmail("equipo");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(error).toBeNull();
  staffIds.push(data.user!.id);
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id,
    email,
    full_name: "Equipo de prueba",
    role: "employee",
  });
  expect(profileError).toBeNull();

  await requestAccess(page, email);

  await expect(page.getByTestId("access-error")).toHaveText(
    "Esta dirección es del equipo de la clínica; entra desde el panel.",
  );
  const { data: account } = await admin
    .from("patient_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  expect(account).toBeNull();
});
