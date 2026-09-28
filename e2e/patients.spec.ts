import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const createdPersonIds: string[] = [];

test.afterEach(async () => {
  if (createdPersonIds.length > 0) {
    await admin.from("people").delete().in("id", createdPersonIds.splice(0));
  }
});

test("searching by surname finds the guardian and her children, tagging the minors", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients`);

  await page.getByTestId("patients-search").fill("martinez");

  const guardianRow = page
    .getByTestId("patient-row")
    .filter({ hasText: "Lucía Martínez Soler" });
  await expect(guardianRow).toBeVisible();

  const noraRow = page
    .getByTestId("patient-row")
    .filter({ hasText: "Nora Ferrer Martínez" });
  await expect(noraRow).toBeVisible();
  await expect(noraRow.getByTestId("patient-minor")).toBeVisible();

  await expect(
    page
      .getByTestId("patient-row")
      .filter({ hasText: "Pablo Ferrer Martínez" }),
  ).toBeVisible();
});

test("searching by phone with a space finds the guardian, and a search with no matches shows the empty state", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients`);

  await page.getByTestId("patients-search").fill("600 111");
  await expect(
    page.getByTestId("patient-row").filter({ hasText: "Lucía Martínez Soler" }),
  ).toBeVisible();

  await page.getByTestId("patients-search").fill("zzz-no-existe-zzz");
  await expect(page.getByTestId("patients-empty")).toBeVisible();
});

test('an archived person is hidden by default and appears once "Ver archivados" is checked', async ({
  page,
}) => {
  const lastName = `Archivada${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Persona",
      last_name: lastName,
      is_patient: false,
      archived_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients`);

  await page.getByTestId("patients-search").fill(lastName);
  await expect(page.getByTestId("patients-empty")).toBeVisible();

  await page.getByTestId("patients-archived").check();
  await expect(
    page.getByTestId("patient-row").filter({ hasText: lastName }),
  ).toBeVisible();
});

test("adding an adult with a unique name takes you to their record", async ({
  page,
}) => {
  const lastName = `Nueva${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop() ?? "";
  createdPersonIds.push(id);

  const { data } = await admin
    .from("people")
    .select("first_name, last_name")
    .eq("id", id)
    .single();
  expect(data).toEqual({ first_name: "Persona", last_name: lastName });
});

test('adding someone with Lucía\'s phone shows the duplicate warning, and "Usar esta persona" takes you to her record without creating anything', async ({
  page,
}) => {
  const lastName = `Duplicada${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Otra");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  const phone = page.getByLabel("Teléfono");
  await phone.fill("+34 600 111 222");
  await phone.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(
    "Lucía Martínez Soler · madre de Nora Ferrer Martínez, Pablo Ferrer Martínez",
  );

  await warning
    .locator("li")
    .filter({ hasText: "Lucía Martínez Soler" })
    .getByTestId("duplicate-use")
    .click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/patients/a0000000-0000-0000-0000-000000000601`,
  );

  const { data } = await admin
    .from("people")
    .select("id")
    .eq("last_name", lastName);
  expect(data).toEqual([]);
});

test("submitting right after typing the seed phone, before the debounced check would have fired on its own, still shows the warning instead of saving", async ({
  page,
}) => {
  const lastName = `Rapida${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Otra");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByLabel("Teléfono").fill("+34 600 111 222");
  await page.getByTestId("person-submit").click();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Lucía Martínez Soler");
  await expect(page).toHaveURL(`${DASHBOARD}/patients/new`);

  const { data } = await admin
    .from("people")
    .select("id")
    .eq("last_name", lastName);
  expect(data).toEqual([]);
});

test("adding someone with the seed DNI written with dots and lowercase reports the duplicate DNI and keeps what was typed", async ({
  page,
}) => {
  const lastName = `ConDni${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Otro");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  const taxId = page.getByLabel("DNI/NIE");
  await taxId.fill("11.223.344-b");
  await taxId.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Jorge Ruiz Pérez");
  await page.getByTestId("duplicate-continue").click();
  await expect(warning).toBeHidden();

  await page.getByTestId("person-submit").click();

  await expect(page.getByTestId("person-error")).toHaveText(
    "Ya existe una persona con ese DNI/NIE.",
  );
  await expect(page.getByLabel("Apellidos")).toHaveValue(lastName);
  await expect(taxId).toHaveValue("11.223.344-b");
});

test("editing the address of a person created by the test saves it", async ({
  page,
}) => {
  const lastName = `Editable${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Persona",
      last_name: lastName,
      is_patient: false,
      address: "Calle Vieja 1",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const id = data?.id ?? "";
  createdPersonIds.push(id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${id}/edit`);

  await page.getByLabel("Dirección").fill("Calle Nueva 22");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(`${DASHBOARD}/patients/${id}`);

  const { data: updated } = await admin
    .from("people")
    .select("address")
    .eq("id", id)
    .single();
  expect(updated?.address).toBe("Calle Nueva 22");
});
