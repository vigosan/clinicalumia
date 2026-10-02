import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { latestCodeFor, latestEmailFor, latestLinkFor } from "./mail";
import { userIdsWithEmails } from "./users";

const WEB = "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:54324/api/v1";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const usedEmails: string[] = [];

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
  const emails = usedEmails.splice(0);
  for (const id of await userIdsWithEmails(admin, emails)) {
    await admin.auth.admin.deleteUser(id);
  }
  for (const email of emails) {
    await admin.from("access_requests").delete().eq("email", email);
    await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
      { method: "DELETE" },
    );
  }
});

async function patientAccount(email: string) {
  const { data, error } = await admin
    .from("patient_accounts")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  expect(error).toBeNull();
  return data;
}

async function requestAccess(page: Page, email: string) {
  await page.goto(`${WEB}/acceder?next=%2Freservar`);
  await page.getByTestId("access-email").fill(email);
  await page.getByTestId("access-submit").click();
}

test("a new patient gets a code by email that opens a session and returns to booking, even after a mail scanner opened the link", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-codigo");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toContainText(
    "Te hemos enviado un enlace y un código",
  );
  const codePage = page.url();

  await page.goto(await latestLinkFor(email, "/acceder/confirmar"));
  await expect(page.getByTestId("access-confirm")).toBeVisible();
  await page.goto(codePage);
  expect(await patientAccount(email)).toBeNull();

  await page.getByTestId("access-code").fill(await latestCodeFor(email));
  await page.getByTestId("access-code-submit").click();

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("reservar-email")).toHaveText(email);
  expect(await patientAccount(email)).toEqual({ email });
});

test("asking for a code with someone else's email creates no patient account, so typing an address proves nothing", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-sin-verificar");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toBeVisible();
  await page.getByTestId("access-code").fill("000000");
  await page.getByTestId("access-code-submit").click();
  await expect(page.getByTestId("access-code-error")).toBeVisible();

  expect(await patientAccount(email)).toBeNull();
});

test("without captcha keys the access form shows no captcha and works as before", async ({
  page,
}) => {
  await page.goto(`${WEB}/acceder`);

  await expect(page.getByTestId("access-email")).toBeVisible();
  await expect(page.getByTestId("captcha")).toHaveCount(0);
});

test("the access email tells the person the link and code only last 15 minutes, so they don't try a stale one", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-caducidad");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toBeVisible();

  expect(await latestEmailFor(email, "Tu acceso a Clínica LUMIA")).toContain(
    "Caduca en 15 minutos.",
  );
});

test("the link in the same email also opens the session, for someone reading mail on this device", async ({
  page,
}) => {
  const email = uniqueEmail("paciente-enlace");

  await requestAccess(page, email);
  await expect(page.getByTestId("access-sent")).toBeVisible();

  await page.goto(await latestLinkFor(email, "/acceder/confirmar"));
  expect(await patientAccount(email)).toBeNull();
  await page.getByTestId("access-confirm").click();

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("reservar-email")).toHaveText(email);
  expect(await patientAccount(email)).toEqual({ email });
});

test("a used or forged link sends the person back to ask for a new one", async ({
  page,
}) => {
  await page.goto(
    `${WEB}/acceder/confirmar?token_hash=caducado&type=email&next=%2Freservar`,
  );
  await page.getByTestId("access-confirm").click();

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
    "Demasiados intentos. Espera unos minutos o llama al 614 552 808.",
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

for (const path of [
  "/acceder?next=%2Freservar",
  "/acceder/codigo?email=alguien%40test.local&next=%2Freservar",
  "/acceder/confirmar?token_hash=cualquiera&next=%2Freservar",
]) {
  test(`on a phone, the web header on ${path.split("?")[0]} sits on its green band above the heading, so it stays readable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${WEB}${path}`);

    const header = await page.getByRole("banner").boundingBox();
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    const band = await page.getByTestId("page-hero").boundingBox();

    expect(heading!.y).toBeGreaterThanOrEqual(band!.y + band!.height);
    expect(band!.y + band!.height).toBeGreaterThanOrEqual(
      header!.y + header!.height,
    );
  });
}
