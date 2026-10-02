import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn, totpCode, waitForNextTotpWindow } from "./auth";
import { slowDownServerActions } from "./server-renders";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const anonKey = env.match(/^ANON_KEY="?([^"\n]+)/m)?.[1] ?? "";
const API_URL = "http://127.0.0.1:54321";
const admin = createClient(API_URL, serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const DASHBOARD = "http://localhost:3001";
const PSICOLOGIA_SPECIALTY_ID = "a0000000-0000-0000-0000-00000000001b";
const PSICOLOGIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005b1";
const SLOW_SERVER_MS = 3000;
const BEFORE_SERVER_MS = 1000;

const createdUserIds: string[] = [];
const invitedEmails: string[] = [];
let editedProfileId: string | null = null;

test.afterEach(async () => {
  for (const email of invitedEmails.splice(0)) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) createdUserIds.push(data.id);
  }
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

async function createSpecialty(page: Page, name: string) {
  await page.getByTestId("specialty-new").click();
  await page.getByTestId("specialty-name-input").fill(name);
  await page.getByTestId("specialty-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("deleting a specialty asks for confirmation, only deletes after confirming, and takes it off the list without waiting for the server", async ({
  page,
}) => {
  await loginAsOwner(page);
  const name = `Borrar ${Date.now()}`;
  await page.goto(`${ADMIN}/specialties`);
  await createSpecialty(page, name);
  const row = page.getByTestId("specialty-row").filter({ hasText: name });
  await row.getByTestId("specialty-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();
  await slowDownServerActions(page, SLOW_SERVER_MS);
  await row.getByTestId("specialty-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(row).toHaveCount(0, { timeout: BEFORE_SERVER_MS });
  await expect
    .poll(async () => {
      const { data: remaining } = await admin
        .from("specialties")
        .select("id")
        .eq("name", name);
      return remaining;
    })
    .toEqual([]);
});

test("deactivating a team member asks for confirmation, and both deactivating and reactivating show at once without waiting for the server", async ({
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

  await slowDownServerActions(page, SLOW_SERVER_MS);
  await row.getByRole("button", { name: "Desactivar" }).click();
  await page.getByTestId("confirm-action").click();
  await expect(row.getByTestId("member-status")).toBeVisible({
    timeout: BEFORE_SERVER_MS,
  });

  await row.getByRole("button", { name: "Activar" }).click();
  await expect(row.getByTestId("member-status")).toHaveCount(0, {
    timeout: BEFORE_SERVER_MS,
  });
  await expect(row.getByRole("button", { name: "Desactivar" })).toBeEnabled();
  const { data: stored } = await admin
    .from("profiles")
    .select("is_active")
    .eq("id", data.user!.id)
    .single();
  expect(stored?.is_active).toBe(true);
});

test("deactivating a member with upcoming appointments is refused and lists them, so they are moved or cancelled first, and the row goes back to active", async ({
  page,
}) => {
  await loginAsOwner(page);
  const fullName = `Empleada Citas ${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `member-citas-${Date.now()}@test.local`,
    password: "lumia-segura-2026",
    email_confirm: true,
  });
  expect(error).toBeNull();
  const memberId = data.user!.id;
  createdUserIds.push(memberId);
  const { error: profileError } = await admin.from("profiles").insert({
    id: memberId,
    email: data.user!.email,
    full_name: fullName,
    role: "employee",
    specialty_id: PSICOLOGIA_SPECIALTY_ID,
    is_active: true,
  });
  expect(profileError).toBeNull();
  const lastName = `Pendiente${Date.now()}`;
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      first_name: "Paciente",
      last_name: lastName,
      birth_date: "1990-01-01",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(personError).toBeNull();
  const day = addDays(todayInMadrid(), 20);
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      professional_id: memberId,
      patient_id: person!.id,
      service_id: PSICOLOGIA_SERVICE_ID,
      starts_at: `${day} 10:30:00 Europe/Madrid`,
      ends_at: `${day} 11:30:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(appointmentError).toBeNull();

  try {
    await page.goto(`${ADMIN}/team`);
    const row = page.getByRole("listitem").filter({ hasText: fullName });
    await slowDownServerActions(page, SLOW_SERVER_MS);
    await row.getByRole("button", { name: "Desactivar" }).click();
    await page.getByTestId("confirm-action").click();
    await expect(row.getByTestId("member-status")).toBeVisible({
      timeout: BEFORE_SERVER_MS,
    });

    await expect(row.getByTestId("member-upcoming")).toContainText(
      "Tiene citas pendientes. Muévelas a otra profesional o cancélalas desde el panel y vuelve a intentarlo.",
    );
    await expect(row.getByTestId("member-upcoming-item")).toHaveText(
      `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)} · 10:30 · Paciente ${lastName}`,
    );
    await expect(row.getByTestId("member-status")).toHaveCount(0);
    const { data: stored } = await admin
      .from("profiles")
      .select("is_active")
      .eq("id", memberId)
      .single();
    expect(stored?.is_active).toBe(true);
  } finally {
    await admin.from("appointments").delete().eq("id", appointment!.id);
    await admin.from("people").delete().eq("id", person!.id);
  }
});

test("the admin home shows the clinic's status: the next quarter to file with its deadline, the next closure and links to the usual sections, without repeating the menu", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/`);
  await expect(page.getByTestId("home-card-team")).toHaveCount(0);

  const filing = page.getByTestId("home-status-quarter");
  await expect(filing).toContainText(
    /T[1-4] de 20\d\d · hasta el \d{1,2} de (enero|abril|julio|octubre)/,
  );
  const [, q, year] =
    (await filing.textContent())!.match(/T([1-4]) de (20\d\d)/) ?? [];
  await filing.getByRole("link").click();
  await expect(page).toHaveURL(`${ADMIN}/facturacion?year=${year}&q=${q}`);
  await page.goto(`${ADMIN}/`);

  const { data: next } = await admin
    .from("clinic_closures")
    .select("starts_on, reason")
    .gte("ends_on", todayInMadrid())
    .order("starts_on")
    .limit(1)
    .maybeSingle();
  const closure = page.getByTestId("home-status-closure");
  if (next) {
    await expect(closure).toContainText(next.reason);
    await closure.getByRole("link").click();
    await expect(page).toHaveURL(
      `${ADMIN}/closures?month=${next.starts_on.slice(0, 7)}`,
    );
  } else {
    await expect(closure).toContainText("No hay cierres previstos.");
    await closure.getByRole("link").click();
    await expect(page).toHaveURL(`${ADMIN}/closures`);
  }
  await page.goto(`${ADMIN}/`);

  for (const [testId, href] of [
    ["home-link-team", "/team"],
    ["home-link-services", "/services"],
    ["home-link-schedules", "/schedules"],
  ]) {
    await page.getByTestId(testId!).click();
    await expect(page).toHaveURL(`${ADMIN}${href}`);
    await page.goto(`${ADMIN}/`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(filing).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
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
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Laura Ejemplo" })
      .getByTestId("member-resend-invite"),
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
    page.getByText(
      "Aún no hay empleados. Invita al primero con «Invitar a un empleado».",
    ),
  ).toHaveCount(0);

  editedProfileId = "a0000000-0000-0000-0000-000000000002";
  const lauraRow = page
    .getByRole("listitem")
    .filter({ hasText: "Laura Ejemplo" });
  await lauraRow.getByTestId("member-edit").click();
  const drawer = page.getByRole("dialog", { name: "Editar empleado" });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Nº de colegiado").fill("46-12345");
  await drawer.getByRole("button", { name: "Guardar" }).click();
  await expect(drawer).toHaveCount(0);
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

test("the owner cuts a member's phone calendar access and the link stops serving the feed", async ({
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
    await expect(row.getByTestId("member-revoke-calendar")).toHaveText(
      "Cortar el acceso al calendario del móvil",
    );
    await row.getByTestId("member-revoke-calendar").click();
    await ownerPage.getByTestId("confirm-action").click();
    await expect(row.getByTestId("member-success")).toHaveText(
      "Acceso al calendario del móvil cortado.",
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

test("on a phone each service is a card whose values keep their column names, so «No» or «21 %» can still be read", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ADMIN}/services`);

  const row = page.getByTestId("service-row").first();
  await expect(row).toBeVisible();
  const labels = await row
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) =>
        getComputedStyle(cell, "::before").content.replaceAll('"', ""),
      ),
    );
  expect(labels).toEqual(
    expect.arrayContaining([
      "Duración",
      "Precio",
      "IVA",
      "Reserva web",
      "Estado",
    ]),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the specialty form opens from the right on a computer and from the bottom on a phone, without covering more than the screen", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/specialties`);
  const drawer = page.getByRole("dialog", { name: "Nueva especialidad" });

  await page.getByTestId("specialty-new").click();
  const desktop = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = (await drawer.boundingBox())!;
      return {
        right: Math.round(box.x + box.width),
        narrower: box.width < desktop.width,
      };
    })
    .toEqual({ right: desktop.width, narrower: true });
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("specialty-new").click();
  await expect
    .poll(async () => {
      const box = (await drawer.boundingBox())!;
      return {
        bottom: Math.round(box.y + box.height),
        width: Math.round(box.width),
        fits: box.height <= 844 * 0.92 + 1,
      };
    })
    .toEqual({ bottom: 844, width: 390, fits: true });
});

test("inviting an employee from its drawer closes it, confirms the email was sent and lists the new member as pending until she sets her password", async ({
  page,
}) => {
  await loginAsOwner(page);
  const fullName = `Invitada Drawer ${Date.now()}`;
  const email = `invitada-drawer-${Date.now()}@test.local`;
  invitedEmails.push(email);
  await page.goto(`${ADMIN}/team`);

  await page.getByTestId("member-invite").click();
  const drawer = page.getByRole("dialog", { name: "Invitar a un empleado" });
  await drawer.getByLabel("Email").fill(email);
  await drawer.getByLabel("Nombre completo").fill(fullName);
  await drawer.getByRole("button", { name: "Invitar" }).click();

  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId("toast")).toHaveText(
    "Invitación enviada por email",
  );
  const row = page.getByRole("listitem").filter({ hasText: fullName });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("member-pending")).toHaveText(
    "Pendiente de aceptar",
  );
  await row.getByTestId("member-resend-invite").click();
  await expect(row.getByTestId("member-success")).toHaveText(
    "Invitación reenviada.",
  );

  const { data: invited } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  const { error: passwordError } = await admin.auth.admin.updateUserById(
    invited!.id,
    { password: "lumia-segura-2026" },
  );
  expect(passwordError).toBeNull();

  await page.reload();
  await expect(row).toBeVisible();
  await expect(row.getByTestId("member-pending")).toHaveCount(0);
  await expect(row.getByTestId("member-resend-invite")).toHaveCount(0);
});

test("deactivating and reactivating a service changes its status at once, without waiting for the server", async ({
  page,
}) => {
  const name = `Servicio optimista ${Date.now()}`;
  const { data: service, error } = await admin
    .from("services")
    .insert({
      specialty_id: PSICOLOGIA_SPECIALTY_ID,
      name,
      duration_minutes: 45,
      price_cents: 4500,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  try {
    await loginAsOwner(page);
    await page.goto(`${ADMIN}/services`);
    const row = page.getByTestId("service-row").filter({ hasText: name });
    await expect(row).toContainText("Activo");
    await slowDownServerActions(page, SLOW_SERVER_MS);

    await row.getByTestId("service-toggle").click();
    await expect(row).toContainText("Inactivo", { timeout: BEFORE_SERVER_MS });
    await expect(row.getByTestId("service-toggle")).toHaveText("Activar", {
      timeout: BEFORE_SERVER_MS,
    });
    await expect(row.getByTestId("service-toggle")).toBeEnabled();
    const { data: stored } = await admin
      .from("services")
      .select("is_active")
      .eq("id", service!.id)
      .single();
    expect(stored?.is_active).toBe(false);
  } finally {
    await admin.from("services").delete().eq("id", service!.id);
  }
});
