import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn, totpCode, waitForNextTotpWindow } from "./auth";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const anonKey = env.match(/^ANON_KEY="?([^"\n]+)/m)?.[1] ?? "";
const API_URL = "http://127.0.0.1:54321";
const admin = createClient(API_URL, serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const DASHBOARD = "http://localhost:3001";

const createdUserIds: string[] = [];
let editedProfileId: string | null = null;

test.afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
  if (editedProfileId) {
    await admin
      .from("profiles")
      .update({ license_number: null })
      .eq("id", editedProfileId);
    editedProfileId = null;
  }
});

async function loginAsOwner(page: import("@playwright/test").Page) {
  const email = `owner-ui-${Date.now()}@test.local`;
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
    full_name: "Propietaria UI",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await signIn(page, ADMIN, email, password);
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
  createdUserIds.push(data.user!.id);
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

test("each card on the admin home links to its section", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/`);
  const sections: [string, string][] = [
    ["home-card-team", "/team"],
    ["home-card-specialties", "/specialties"],
    ["home-card-services", "/services"],
    ["home-card-schedules", "/schedules"],
    ["home-card-clinic", "/clinic"],
  ];
  for (const [testId, href] of sections) {
    await page.getByTestId(testId).click();
    await expect(page).toHaveURL(`${ADMIN}${href}`);
    await page.goto(`${ADMIN}/`);
  }
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
  await page.getByTestId("nav-toggle").click();
  await expect(
    page
      .getByRole("dialog", { name: "Menú" })
      .getByRole("link", { name: "Especialidades" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the seed owner is listed first as Propietaria without a deactivate button, the empty-team notice stays hidden, and a member's license number can be set", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/team`);

  const ownerRow = page
    .getByRole("listitem")
    .filter({ hasText: "info@clinicalumia.es" });
  await expect(ownerRow.getByText("Propietaria")).toBeVisible();
  await expect(
    ownerRow.getByRole("button", { name: "Desactivar" }),
  ).toHaveCount(0);
  await expect(
    ownerRow.getByRole("button", { name: "Reenviar invitación" }),
  ).toHaveCount(0);

  const rowsText = await page.getByRole("listitem").allTextContents();
  const ownerIndex = rowsText.findIndex((text) =>
    text.includes("Patricia Hernán"),
  );
  const lauraIndex = rowsText.findIndex((text) =>
    text.includes("Laura Ejemplo"),
  );
  const marcIndex = rowsText.findIndex((text) => text.includes("Marc Ejemplo"));
  expect(ownerIndex).toBeLessThan(lauraIndex);
  expect(ownerIndex).toBeLessThan(marcIndex);

  await expect(
    page.getByText("Aún no hay empleados. Invita al primero arriba."),
  ).toHaveCount(0);

  editedProfileId = "a0000000-0000-0000-0000-000000000002";
  const lauraRow = page
    .getByRole("listitem")
    .filter({ hasText: "Laura Ejemplo" });
  await lauraRow.getByRole("button", { name: "Editar" }).click();
  const editingRow = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Guardar" }) });
  await editingRow.getByLabel("Nº de colegiado").fill("46-12345");
  await editingRow.getByRole("button", { name: "Guardar" }).click();
  await expect(lauraRow.getByTestId("member-license")).toHaveText(
    "Nº colegiado 46-12345",
  );
});

test("the owner resets an employee's two-factor step, closing their still-open session and requiring them to activate it again", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const employeeContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    const employeePage = await employeeContext.newPage();

    const fullName = `Empleado Reset ${Date.now()}`;
    const employeeEmail = `empleado-reset-${Date.now()}@test.local`;
    const employeePassword = "lumia-segura-2026";
    const { data, error } = await admin.auth.admin.createUser({
      email: employeeEmail,
      password: employeePassword,
      email_confirm: true,
    });
    expect(error).toBeNull();
    createdUserIds.push(data.user!.id);
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user!.id,
      email: employeeEmail,
      full_name: fullName,
      role: "employee",
      is_active: true,
    });
    expect(profileError).toBeNull();

    const secret = await signIn(
      employeePage,
      DASHBOARD,
      employeeEmail,
      employeePassword,
    );
    expect(secret).toBeTruthy();

    const rawClient = createClient(API_URL, anonKey);
    const { error: rawSignInError } = await rawClient.auth.signInWithPassword({
      email: employeeEmail,
      password: employeePassword,
    });
    expect(rawSignInError).toBeNull();
    const { data: factorsData } = await rawClient.auth.mfa.listFactors();
    const factor = factorsData?.totp.find((f) => f.status === "verified");
    expect(factor).toBeTruthy();
    let { error: verifyError } = await rawClient.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totpCode(secret!),
    });
    if (verifyError) {
      await waitForNextTotpWindow(secret!);
      ({ error: verifyError } = await rawClient.auth.mfa.challengeAndVerify({
        factorId: factor!.id,
        code: totpCode(secret!),
      }));
    }
    expect(verifyError).toBeNull();
    const { data: rawSessionData } = await rawClient.auth.getSession();
    const oldAccessToken = rawSessionData.session!.access_token;

    const beforeReset = await fetch(
      `${API_URL}/rest/v1/specialties?select=id`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${oldAccessToken}` },
      },
    ).then((response) => response.json());
    expect(beforeReset.length).toBeGreaterThan(0);

    await loginAsOwner(ownerPage);
    await ownerPage.goto(`${ADMIN}/team`);
    const row = ownerPage.getByRole("listitem").filter({ hasText: fullName });
    await row.getByTestId("member-reset-2fa").click();
    await ownerPage.getByTestId("confirm-action").click();
    await expect(row.getByTestId("member-error")).toHaveCount(0);

    await expect
      .poll(async () => {
        const response = await fetch(
          `${API_URL}/rest/v1/specialties?select=id`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${oldAccessToken}`,
            },
          },
        );
        return response.json();
      })
      .toEqual([]);

    await employeePage.goto(`${DASHBOARD}/`);
    await expect(employeePage).toHaveURL(`${DASHBOARD}/login`);

    await employeePage.fill('[name="email"]', employeeEmail);
    await employeePage.fill('[name="password"]', employeePassword);
    await employeePage.getByTestId("login-submit").click();
    await expect(employeePage.getByTestId("totp-start")).toBeVisible();
    await expect(employeePage.getByTestId("totp-code")).toHaveCount(0);
  } finally {
    await ownerContext.close();
    await employeeContext.close();
  }
});

test("the owner invalidates a member's calendar link and it stops serving the feed", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const employeeContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    const employeePage = await employeeContext.newPage();

    const fullName = `Empleada Calendario ${Date.now()}`;
    const employeeEmail = `empleada-calendario-${Date.now()}@test.local`;
    const employeePassword = "lumia-segura-2026";
    const { data, error } = await admin.auth.admin.createUser({
      email: employeeEmail,
      password: employeePassword,
      email_confirm: true,
    });
    expect(error).toBeNull();
    createdUserIds.push(data.user!.id);
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user!.id,
      email: employeeEmail,
      full_name: fullName,
      role: "employee",
      is_active: true,
    });
    expect(profileError).toBeNull();

    await signIn(employeePage, DASHBOARD, employeeEmail, employeePassword);
    await employeePage.goto(`${DASHBOARD}/mi-calendario`);
    await employeePage.getByTestId("calendar-generate").click();
    const url = (
      await employeePage.getByTestId("calendar-url").textContent()
    )?.trim();
    expect(url).toBeTruthy();

    const beforeRevoke = await fetch(url!);
    expect(beforeRevoke.status).toBe(200);

    await loginAsOwner(ownerPage);
    await ownerPage.goto(`${ADMIN}/team`);
    const row = ownerPage.getByRole("listitem").filter({ hasText: fullName });
    await row.getByTestId("member-revoke-calendar").click();
    await ownerPage.getByTestId("confirm-action").click();
    await expect(row.getByTestId("member-success")).toHaveText(
      "Calendario invalidado.",
    );
    await expect(row.getByTestId("member-success")).toHaveAttribute(
      "role",
      "status",
    );

    const afterRevoke = await fetch(url!);
    expect(afterRevoke.status).toBe(404);
  } finally {
    await ownerContext.close();
    await employeeContext.close();
  }
});
