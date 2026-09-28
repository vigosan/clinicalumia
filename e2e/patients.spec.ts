import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];

async function loginAsOwner(page: Page) {
  const email = `owner-patients-${Date.now()}@test.local`;
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
    full_name: "Propietaria de prueba",
    role: "owner",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await signIn(page, DASHBOARD, email, password);
}

test.afterEach(async () => {
  if (createdPersonIds.length > 0) {
    await admin.from("people").delete().in("id", createdPersonIds.splice(0));
  }
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id);
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

test("double-clicking Guardar on a new unique person creates exactly one row, not two", async ({
  page,
}) => {
  const lastName = `DobleClic${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByLabel("Teléfono").fill(`6${Date.now() % 100000000}`);
  await page.getByTestId("person-submit").dblclick();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop() ?? "";
  createdPersonIds.push(id);

  const { data, count } = await admin
    .from("people")
    .select("id", { count: "exact" })
    .eq("last_name", lastName);
  expect(count).toBe(1);
  expect(data?.map((row) => row.id)).toEqual([id]);
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

test('creating a minor patient shows "Menor sin tutor", and adding their mother through guardianOf links them both ways', async ({
  page,
}) => {
  const minorLastName = `Menor${Date.now()}`;
  const motherLastName = `Madre${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);
  await page.getByLabel("Nombre").fill("Hijo");
  await page.getByLabel("Apellidos").fill(minorLastName);
  await page.getByLabel("Fecha de nacimiento").fill("2015-01-01");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const minorId = page.url().split("/").pop() ?? "";
  createdPersonIds.push(minorId);
  await expect(page.getByTestId("patient-no-guardian")).toBeVisible();

  await page.getByTestId("guardian-add").click();
  await page.getByRole("link", { name: "Nueva persona" }).click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/patients/new?guardianOf=${minorId}`,
  );

  await page.getByLabel("Nombre").fill("Madre");
  await page.getByLabel("Apellidos").fill(motherLastName);
  await page.getByTestId("guardian-relationship").selectOption("madre");
  await page.getByTestId("guardian-primary").check();
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(`${DASHBOARD}/patients/${minorId}`);
  await expect(page.getByTestId("patient-no-guardian")).toBeHidden();
  const guardianRow = page
    .getByTestId("guardian-row")
    .filter({ hasText: motherLastName });
  await expect(guardianRow).toBeVisible();
  await expect(guardianRow).toContainText("Madre");
  await expect(guardianRow).toContainText("Principal");

  const { data: mother } = await admin
    .from("people")
    .select("id")
    .eq("last_name", motherLastName)
    .single();
  const motherId = mother?.id ?? "";
  createdPersonIds.push(motherId);

  await page.goto(`${DASHBOARD}/patients/${motherId}`);
  const wardRow = page
    .getByTestId("ward-row")
    .filter({ hasText: minorLastName });
  await expect(wardRow).toBeVisible();
});

test("trying to add the minor as their own guardian shows the error", async ({
  page,
}) => {
  const lastName = `Autotutor${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Solo",
      last_name: lastName,
      is_patient: true,
      birth_date: "2015-01-01",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const minorId = data!.id;
  createdPersonIds.push(minorId);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("guardian-add").click();
  await page.getByTestId("guardian-search").fill(lastName);
  const option = page
    .getByTestId("guardian-option")
    .filter({ hasText: lastName });
  await expect(option).toBeVisible();
  await option.click();
  await page.getByTestId("guardian-save").click();

  await expect(page.getByTestId("person-action-error")).toHaveText(
    "Una persona no puede ser su propio tutor.",
  );
});

test('archiving a minor patient hides them from the list, "Ver archivados" shows them, and Recuperar brings them back', async ({
  page,
}) => {
  const lastName = `ParaArchivar${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Persona",
      last_name: lastName,
      is_patient: true,
      birth_date: "2015-01-01",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const id = data!.id;
  createdPersonIds.push(id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${id}`);

  await page.getByTestId("person-archive").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("person-archive")).toHaveText("Recuperar");

  await page.goto(`${DASHBOARD}/patients`);
  await page.getByTestId("patients-search").fill(lastName);
  await expect(page.getByTestId("patients-empty")).toBeVisible();
  await page.getByTestId("patients-archived").check();
  await expect(
    page.getByTestId("patient-row").filter({ hasText: lastName }),
  ).toBeVisible();

  await page.goto(`${DASHBOARD}/patients/${id}`);
  await page.getByTestId("person-archive").click();
  await expect(page.getByTestId("person-archive")).toHaveText("Archivar");

  await page.goto(`${DASHBOARD}/patients`);
  await page.getByTestId("patients-search").fill(lastName);
  await expect(
    page.getByTestId("patient-row").filter({ hasText: lastName }),
  ).toBeVisible();
});

test("an employee cannot see the Eliminar button on a patient's record", async ({
  page,
}) => {
  const lastName = `SinEliminar${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({ first_name: "Persona", last_name: lastName, is_patient: false })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${data!.id}`);
  await expect(page.getByTestId("person-delete")).toHaveCount(0);
});

test("a throwaway owner cannot delete a guardian who still has wards, but can delete the minor", async ({
  page,
}) => {
  const motherLastName = `Tutora${Date.now()}`;
  const minorLastName = `Tutelado${Date.now()}`;

  const { data: mother, error: motherError } = await admin
    .from("people")
    .insert({
      first_name: "Madre",
      last_name: motherLastName,
      is_patient: false,
    })
    .select("id")
    .single();
  expect(motherError).toBeNull();
  const motherId = mother!.id;
  createdPersonIds.push(motherId);

  const { data: minor, error: minorError } = await admin
    .from("people")
    .insert({
      first_name: "Hijo",
      last_name: minorLastName,
      is_patient: true,
      birth_date: "2015-01-01",
    })
    .select("id")
    .single();
  expect(minorError).toBeNull();
  const minorId = minor!.id;
  createdPersonIds.push(minorId);

  const { error: guardianshipError } = await admin
    .from("guardianships")
    .insert({
      minor_id: minorId,
      guardian_id: motherId,
      relationship: "madre",
      is_primary: true,
    });
  expect(guardianshipError).toBeNull();

  await loginAsOwner(page);

  await page.goto(`${DASHBOARD}/patients/${motherId}`);
  await page.getByTestId("person-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("person-action-error")).toHaveText(
    "No se puede eliminar: tiene menores a su cargo.",
  );

  await page.goto(`${DASHBOARD}/patients/${minorId}`);
  await page.getByTestId("person-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients`);

  const { data: stillThere } = await admin
    .from("people")
    .select("id")
    .eq("id", minorId)
    .maybeSingle();
  expect(stillThere).toBeNull();
});
