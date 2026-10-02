import { execSync } from "node:child_process";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";
import { selectOption } from "./select";

const DASHBOARD = "http://localhost:3001";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];
const createdAppointmentIds: string[] = [];
const MARC_ID = "a0000000-0000-0000-0000-000000000003";
const FISIOTERAPIA_SERVICE_ID = "a0000000-0000-0000-0000-0000000005c1";

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
  if (createdAppointmentIds.length > 0) {
    const { error: appointmentsError } = await admin
      .from("appointments")
      .delete()
      .in("id", createdAppointmentIds.splice(0));
    expect(appointmentsError).toBeNull();
  }
  if (createdPersonIds.length > 0) {
    const ids = [...createdPersonIds];
    const { error: guardianshipsError } = await admin
      .from("guardianships")
      .delete()
      .or(`minor_id.in.(${ids.join(",")}),guardian_id.in.(${ids.join(",")})`);
    expect(guardianshipsError).toBeNull();
    const { error: peopleError } = await admin
      .from("people")
      .delete()
      .in("id", createdPersonIds.splice(0));
    expect(peopleError).toBeNull();
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

test("searching by a dni written with dot separators finds the person, since the stored dni has none", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients`);

  await page.getByTestId("patients-search").fill("11.223.344");
  await expect(
    page.getByTestId("patient-row").filter({ hasText: "Jorge Ruiz Pérez" }),
  ).toBeVisible();
});

test("an archived person is hidden by default and appears once the «Archivados» filter is chosen", async ({
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

test("adding an adult from «Nuevo paciente» takes you to their record as a patient, without asking whether they are one", async ({
  page,
}) => {
  const lastName = `Nueva${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  await expect(page.getByLabel(/es paciente/i)).toHaveCount(0);
  await expect(page.getByTestId("person-submit")).toHaveText("Crear ficha");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop() ?? "";
  createdPersonIds.push(id);

  const { data } = await admin
    .from("people")
    .select("first_name, last_name, is_patient, birth_date")
    .eq("id", id)
    .single();
  expect(data).toEqual({
    first_name: "Persona",
    last_name: lastName,
    is_patient: true,
    birth_date: "1990-01-01",
  });
});

test("una fecha de nacimiento que no existe no deja guardar la ficha, en vez de guardarla sin fecha", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(`Invalida${Date.now()}`);
  const birthDate = page.getByLabel("Fecha de nacimiento");
  await birthDate.pressSequentially("31021990");
  await expect(birthDate).toHaveValue("31/02/1990");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(`${DASHBOARD}/patients/new`);
  expect(
    await birthDate.evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false);
  await expect(birthDate).toHaveAttribute("aria-invalid", "true");
});

test("double-clicking Guardar on a new unique person creates exactly one row, not two", async ({
  page,
}) => {
  const lastName = `DobleClic${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Persona");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  await page
    .getByLabel("Teléfono")
    .fill(`6${String(Date.now() % 1e8).padStart(8, "0")}`);
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

test('adding someone with Lucía\'s phone shows the duplicate warning, and "Usar esta ficha" takes you to her record without creating anything', async ({
  page,
}) => {
  const lastName = `Duplicada${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Otra");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  const phone = page.getByLabel("Teléfono");
  await phone.fill("+34 600 111 222");
  await phone.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  const duplicateRow = warning
    .locator("li")
    .filter({ hasText: "Lucía Martínez Soler" });
  await expect(duplicateRow.getByTestId("duplicate-matched")).toHaveText(
    "mismo teléfono",
  );
  await expect(duplicateRow).toContainText(
    "madre de Nora Ferrer Martínez, Pablo Ferrer Martínez",
  );

  await duplicateRow.getByTestId("duplicate-use").click();
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
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
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
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  const taxId = page.getByLabel("DNI/NIE");
  await taxId.fill("11.223.344-b");
  await taxId.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Jorge Ruiz Pérez");
  await page.getByTestId("duplicate-continue").click();
  await expect(warning).toBeHidden();

  await page.getByTestId("person-submit").click();

  await expect(page.getByTestId("person-error")).toContainText(
    "Ya hay una ficha con ese DNI/NIE.",
  );
  await expect(page.getByTestId("person-error-existing")).toHaveAttribute(
    "href",
    "/patients/a0000000-0000-0000-0000-000000000604",
  );
  await expect(page.getByLabel("Apellidos")).toHaveValue(lastName);
  await expect(taxId).toHaveValue("11.223.344-b");
});

async function insertPerson(person: {
  first_name: string;
  last_name: string;
  birth_date: string;
  tax_id?: string;
  archived?: boolean;
}) {
  const { archived, ...fields } = person;
  const { data, error } = await admin
    .from("people")
    .insert({
      ...fields,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);
  return data!.id;
}

function validDni(): string {
  const number = Date.now() % 1e8;
  return `${String(number).padStart(8, "0")}${"TRWAGMYFPDXBNJZSQVHLCKE"[number % 23]}`;
}

test("typing the name of an existing minor without accents or capitals and her birth date warns before creating a second record, since minors rarely have a DNI, email or phone", async ({
  page,
}) => {
  const suffix = String(Date.now());
  const existingId = await insertPerson({
    first_name: "Elena",
    last_name: `Gómez Díaz ${suffix}`,
    birth_date: "2015-03-22",
  });

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("ELENA");
  await page.getByLabel("Apellidos").fill(`gomez diaz ${suffix}`);
  const birthDate = page.getByLabel("Fecha de nacimiento");
  await birthDate.fill("22/03/2015");
  await birthDate.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  const duplicateRow = warning
    .locator("li")
    .filter({ hasText: `Elena Gómez Díaz ${suffix}` });
  await expect(duplicateRow.getByTestId("duplicate-matched")).toHaveText(
    "mismo nombre y fecha de nacimiento",
  );
  await expect(duplicateRow.getByTestId("duplicate-archived")).toHaveCount(0);

  await duplicateRow.getByTestId("duplicate-use").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${existingId}`);

  const { count } = await admin
    .from("people")
    .select("id", { count: "exact", head: true })
    .ilike("last_name", `%${suffix}`);
  expect(count).toBe(1);
});

test("an archived record with the same name and birth date shows up as «Ficha archivada», and «Desarchivar y usar esta ficha» brings it back instead of creating a new one", async ({
  page,
}) => {
  const lastName = `Vuelve ${Date.now()}`;
  const archivedId = await insertPerson({
    first_name: "Lucía",
    last_name: lastName,
    birth_date: "1975-05-05",
    archived: true,
  });

  await loginAsOwner(page);
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Lucia");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("05/05/1975");
  await page.getByTestId("person-submit").click();

  const duplicateRow = page
    .getByTestId("duplicate-warning")
    .locator("li")
    .filter({ hasText: `Lucía ${lastName}` });
  await expect(duplicateRow.getByTestId("duplicate-archived")).toHaveText(
    "Ficha archivada",
  );
  await expect(duplicateRow.getByTestId("duplicate-use")).toHaveCount(0);

  await duplicateRow.getByTestId("duplicate-unarchive").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${archivedId}`);
  await expect(page.getByTestId("person-archive")).toHaveText("Archivar");

  const { data } = await admin
    .from("people")
    .select("id, archived_at")
    .eq("last_name", lastName);
  expect(data).toEqual([{ id: archivedId, archived_at: null }]);
});

test("an employee who finds an archived duplicate is told to ask the owner to unarchive it, instead of a button that would fail", async ({
  page,
}) => {
  const lastName = `ArchivadaEmpleada ${Date.now()}`;
  await insertPerson({
    first_name: "Lucía",
    last_name: lastName,
    birth_date: "1975-05-05",
    archived: true,
  });

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Lucia");
  await page.getByLabel("Apellidos").fill(lastName);
  await page.getByLabel("Fecha de nacimiento").fill("05/05/1975");
  await page.getByTestId("person-submit").click();

  const duplicateRow = page
    .getByTestId("duplicate-warning")
    .locator("li")
    .filter({ hasText: `Lucía ${lastName}` });
  await expect(duplicateRow.getByTestId("duplicate-archived")).toHaveText(
    "Ficha archivada",
  );
  await expect(duplicateRow.getByTestId("duplicate-ask-owner")).toHaveText(
    "pide a la propietaria que la desarchive",
  );
  await expect(duplicateRow.getByTestId("duplicate-unarchive")).toHaveCount(0);
  await expect(duplicateRow.getByTestId("duplicate-use")).toHaveCount(0);
});

test("saving a new record with the DNI of an archived one says so and links to that archived record, so the team can recover it", async ({
  page,
}) => {
  const dni = validDni();
  const lastName = `Archivado ${Date.now()}`;
  const archivedId = await insertPerson({
    first_name: "Mario",
    last_name: lastName,
    birth_date: "1960-01-01",
    tax_id: dni,
    archived: true,
  });

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);

  await page.getByLabel("Nombre").fill("Otro");
  await page.getByLabel("Apellidos").fill(`Distinto ${Date.now()}`);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/1990");
  const taxId = page.getByLabel("DNI/NIE");
  await taxId.fill(dni);
  await taxId.blur();

  const duplicateRow = page
    .getByTestId("duplicate-warning")
    .locator("li")
    .filter({ hasText: `Mario ${lastName}` });
  await expect(duplicateRow.getByTestId("duplicate-matched")).toHaveText(
    "mismo DNI/NIE",
  );
  await expect(duplicateRow.getByTestId("duplicate-archived")).toBeVisible();
  await page.getByTestId("duplicate-continue").click();
  await page.getByTestId("person-submit").click();

  await expect(page.getByTestId("person-error")).toContainText(
    "Ya hay una ficha con ese DNI/NIE.",
  );
  await page.getByTestId("person-error-existing").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${archivedId}`);
  await expect(page.getByRole("main")).toContainText("Ficha archivada");
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

test('creating a minor patient shows "Menor sin tutor/a", and adding their guardian through guardianOf links them both ways and saves the chosen relationship and «También es paciente»', async ({
  page,
}) => {
  const minorLastName = `Menor${Date.now()}`;
  const motherLastName = `Madre${Date.now()}`;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new`);
  await page.getByLabel("Nombre").fill("Hijo");
  await page.getByLabel("Apellidos").fill(minorLastName);
  await page.getByLabel("Fecha de nacimiento").fill("01/01/2015");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const minorId = page.url().split("/").pop() ?? "";
  createdPersonIds.push(minorId);
  await expect(page.getByTestId("patient-no-guardian")).toBeVisible();
  await expect(page.getByTestId("guardians-section")).toContainText(
    "No tiene tutor/a.",
  );

  await page.getByTestId("guardian-add").click();
  await page.getByTestId("guardian-search").click();
  await page.getByRole("option", { name: "Nuevo tutor/a" }).click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/patients/new?guardianOf=${minorId}`,
  );

  await page.getByLabel("Nombre").fill("Madre");
  await page.getByLabel("Apellidos").fill(motherLastName);
  await selectOption(page.getByTestId("guardian-relationship"), "tutor_legal");
  await page.getByTestId("guardian-primary").check();
  await expect(page.getByTestId("person-is-patient")).not.toBeChecked();
  await page.getByTestId("person-is-patient").click();
  await page.getByLabel("Fecha de nacimiento").fill("04/03/1985");
  await page.getByTestId("person-submit").click();

  await expect(page).toHaveURL(`${DASHBOARD}/patients/${minorId}`);
  await expect(page.getByTestId("patient-no-guardian")).toBeHidden();
  const guardianRow = page
    .getByTestId("guardian-row")
    .filter({ hasText: motherLastName });
  await expect(guardianRow).toBeVisible();
  await expect(guardianRow).toContainText("Tutor legal");
  await expect(guardianRow).toContainText("Principal");

  const { data: mother } = await admin
    .from("people")
    .select("id, is_patient")
    .eq("last_name", motherLastName)
    .single();
  const motherId = mother?.id ?? "";
  createdPersonIds.push(motherId);
  expect(mother?.is_patient).toBe(true);

  await page.goto(`${DASHBOARD}/patients/${motherId}`);
  const wardRow = page
    .getByTestId("ward-row")
    .filter({ hasText: minorLastName });
  await expect(wardRow).toBeVisible();
});

test('in the guardianOf flow, "Usar esta ficha" links the existing record as guardian instead of creating a new one', async ({
  page,
}) => {
  const minorLastName = `MenorUsar${Date.now()}`;
  const existingLastName = `ExistenteUsar${Date.now()}`;
  const phone = `6${String(Date.now() % 1e8).padStart(8, "0")}`;

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

  const { data: existing, error: existingError } = await admin
    .from("people")
    .insert({
      first_name: "Existente",
      last_name: existingLastName,
      is_patient: false,
      phone,
    })
    .select("id")
    .single();
  expect(existingError).toBeNull();
  const existingId = existing!.id;
  createdPersonIds.push(existingId);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new?guardianOf=${minorId}`);

  await page.getByLabel("Nombre").fill("Otra");
  await page.getByLabel("Apellidos").fill(`NoCreada${Date.now()}`);
  await selectOption(page.getByTestId("guardian-relationship"), "madre");
  await page.getByTestId("guardian-primary").check();
  const phoneField = page.getByLabel("Teléfono");
  await phoneField.fill(phone);
  await phoneField.blur();

  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toBeVisible();
  await warning
    .locator("li")
    .filter({ hasText: existingLastName })
    .getByTestId("duplicate-use")
    .click();

  await expect(page).toHaveURL(`${DASHBOARD}/patients/${minorId}`);
  const guardianRow = page
    .getByTestId("guardian-row")
    .filter({ hasText: existingLastName });
  await expect(guardianRow).toBeVisible();
  await expect(guardianRow).toContainText("Madre");
  await expect(guardianRow).toContainText("Principal");

  const { data: guardianship } = await admin
    .from("guardianships")
    .select("guardian_id, is_primary")
    .eq("minor_id", minorId)
    .single();
  expect(guardianship).toEqual({ guardian_id: existingId, is_primary: true });

  const { data: notCreated } = await admin
    .from("people")
    .select("id")
    .eq("phone", phone)
    .neq("id", existingId);
  expect(notCreated).toEqual([]);
});

test("the guardian picker excludes the ficha's own person and people already added as guardians", async ({
  page,
}) => {
  const shared = `Candidato${Date.now()}`;
  const minorLastName = `${shared}Menor`;
  const guardianLastName = `${shared}Tutora`;
  const newLastName = `${shared}Nueva`;

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

  const { data: guardian, error: guardianError } = await admin
    .from("people")
    .insert({
      first_name: "Madre",
      last_name: guardianLastName,
      is_patient: false,
    })
    .select("id")
    .single();
  expect(guardianError).toBeNull();
  const guardianId = guardian!.id;
  createdPersonIds.push(guardianId);

  const { error: guardianshipError } = await admin
    .from("guardianships")
    .insert({
      minor_id: minorId,
      guardian_id: guardianId,
      relationship: "madre",
      is_primary: true,
    });
  expect(guardianshipError).toBeNull();

  const { data: newPerson, error: newPersonError } = await admin
    .from("people")
    .insert({
      first_name: "Vecina",
      last_name: newLastName,
      is_patient: false,
    })
    .select("id")
    .single();
  expect(newPersonError).toBeNull();
  createdPersonIds.push(newPerson!.id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("guardian-add").click();
  await page.getByTestId("guardian-search").fill(shared);

  await expect(
    page.getByTestId("guardian-option").filter({ hasText: newLastName }),
  ).toBeVisible();
  await expect(
    page.getByTestId("guardian-option").filter({ hasText: minorLastName }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("guardian-option").filter({ hasText: guardianLastName }),
  ).toHaveCount(0);
});

test('searching for someone who does not exist shows "No hay ninguna ficha con esos datos.", and Cancelar always closes the panel', async ({
  page,
}) => {
  const minorLastName = `MenorCerrar${Date.now()}`;

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

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("guardian-add").click();
  await expect(
    page.getByRole("dialog", { name: "Añadir tutor/a" }),
  ).toBeVisible();
  await expect(page.getByTestId("guardian-close")).toBeVisible();

  await page.getByTestId("guardian-search").fill("zzz-no-existe-zzz");
  await expect(page.getByTestId("guardian-search-empty")).toHaveText(
    "No hay ninguna ficha con esos datos.",
  );

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("guardian-search-empty")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Añadir tutor/a" }),
  ).toBeVisible();
  await page.getByTestId("guardian-close").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("guardian-search")).toHaveCount(0);
  await expect(page.getByTestId("guardian-add")).toBeFocused();
});

test("añadir tutor/a busca fichas con edad y teléfono, se elige con el teclado y queda guardado con su parentesco", async ({
  page,
}) => {
  const suffix = Date.now();
  const { data: people, error: peopleError } = await admin
    .from("people")
    .insert([
      {
        first_name: "Hija",
        last_name: `MenorTutora${suffix}`,
        is_patient: true,
        birth_date: "2016-05-05",
      },
      {
        first_name: "Abuela",
        last_name: `TutoraBuscada${suffix}`,
        is_patient: false,
        birth_date: "1960-02-02",
        phone: "+34622333444",
      },
    ])
    .select("id, first_name");
  expect(peopleError).toBeNull();
  const minorId = people!.find((p) => p.first_name === "Hija")!.id;
  const guardianId = people!.find((p) => p.first_name === "Abuela")!.id;
  createdPersonIds.push(minorId, guardianId);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("guardian-add").click();
  const search = page.getByTestId("guardian-search");
  await search.fill(`TutoraBuscada${suffix}`);
  const option = page.getByTestId("guardian-option");
  await expect(option).toHaveCount(1);
  await expect(option).toContainText(`Abuela TutoraBuscada${suffix}`);
  await expect(option).toContainText(/\d+ años/);
  await expect(option).toContainText("622333444");
  await search.press("Enter");
  await expect(page.getByTestId("guardian-selected")).toContainText(
    `Abuela TutoraBuscada${suffix}`,
  );
  await expect(search).toHaveCount(0);

  await page.getByTestId("guardian-change").click();
  await expect(page.getByTestId("guardian-save")).toHaveCount(0);
  await expect(page.getByTestId("guardian-selected")).toHaveCount(0);
  await expect(search).toBeFocused();
  await search.fill(`TutoraBuscada${suffix}`);
  await expect(option).toHaveCount(1);
  await search.press("Enter");

  await selectOption(page.getByTestId("guardian-relationship"), "otro");
  await page.getByTestId("guardian-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("guardian-row")).toContainText(
    `Abuela TutoraBuscada${suffix}`,
  );

  const { data: saved } = await admin
    .from("guardianships")
    .select("guardian_id, relationship")
    .eq("minor_id", minorId);
  expect(saved).toEqual([{ guardian_id: guardianId, relationship: "otro" }]);
});

test("archiving a minor patient hides them from the list, the «Archivados» filter shows them, and Desarchivar brings them back", async ({
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

  await loginAsOwner(page);
  await page.goto(`${DASHBOARD}/patients/${id}`);

  await page.getByTestId("person-archive").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("person-archive")).toHaveText("Desarchivar");

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

test("an employee edits a record but cannot see Eliminar, Archivar, Desarchivar nor Quitar tutor/a, which only the owner may do", async ({
  page,
}) => {
  const stamp = Date.now();
  const { data: people, error } = await admin
    .from("people")
    .insert([
      {
        first_name: "Menor",
        last_name: `SinArchivar${stamp}`,
        is_patient: true,
        birth_date: "2016-01-01",
      },
      {
        first_name: "Tutora",
        last_name: `SinQuitar${stamp}`,
        is_patient: false,
      },
      {
        first_name: "Archivada",
        last_name: `SinDesarchivar${stamp}`,
        is_patient: false,
        archived_at: new Date().toISOString(),
      },
    ])
    .select("id, first_name");
  expect(error).toBeNull();
  const idOf = (firstName: string) =>
    people!.find((person) => person.first_name === firstName)!.id;
  createdPersonIds.push(...people!.map((person) => person.id));
  const { error: guardianshipError } = await admin
    .from("guardianships")
    .insert({
      minor_id: idOf("Menor"),
      guardian_id: idOf("Tutora"),
      relationship: "madre",
      is_primary: true,
    });
  expect(guardianshipError).toBeNull();

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${idOf("Menor")}`);
  await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  await expect(page.getByTestId("guardian-row")).toContainText(
    `Tutora SinQuitar${stamp}`,
  );
  await expect(page.getByTestId("guardian-remove")).toHaveCount(0);
  await expect(page.getByTestId("person-archive")).toHaveCount(0);
  await expect(page.getByTestId("person-delete")).toHaveCount(0);

  await page.goto(`${DASHBOARD}/patients/${idOf("Archivada")}`);
  await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  await expect(page.getByTestId("person-archive")).toHaveCount(0);
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

test("clicking a person's name in the list, an archive/recover round trip, and clicking a guardian's name from a minor's record", async ({
  page,
}) => {
  const minorLastName = `ClicMenor${Date.now()}`;
  const motherLastName = `ClicMadre${Date.now()}`;

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
  await page.goto(`${DASHBOARD}/patients`);
  await page.getByTestId("patients-search").fill(minorLastName);
  await expect(page).toHaveURL(
    `${DASHBOARD}/patients?q=${encodeURIComponent(minorLastName)}`,
  );

  await page
    .getByTestId("patient-row")
    .filter({ hasText: minorLastName })
    .getByTestId("patient-link")
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("person-archive").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("person-archive")).toHaveText("Desarchivar");

  await page.goto(`${DASHBOARD}/patients`);
  await page.getByTestId("patients-search").fill(minorLastName);
  await page.getByTestId("patients-archived").check();
  await page
    .getByTestId("patient-row")
    .filter({ hasText: minorLastName })
    .getByTestId("patient-link")
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${minorId}`);

  await page.getByTestId("person-archive").click();
  await expect(page.getByTestId("person-archive")).toHaveText("Archivar");

  const guardianRow = page
    .getByTestId("guardian-row")
    .filter({ hasText: motherLastName });
  await guardianRow.getByTestId("guardian-link").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${motherId}`);

  await expect(
    page.getByTestId("ward-row").filter({ hasText: minorLastName }),
  ).toBeVisible();
});

test("a patient with no appointments offers «Nueva cita» for them, and Cancelar brings staff back to the record; archived and guardian-only records don't, since booking them would fail", async ({
  page,
}) => {
  const lastName = `SinCitas${Date.now()}`;
  const { data: people, error } = await admin
    .from("people")
    .insert([
      {
        first_name: "Paciente",
        last_name: lastName,
        birth_date: "1985-03-10",
        is_patient: true,
      },
      {
        first_name: "Archivado",
        last_name: lastName,
        birth_date: "1985-03-10",
        is_patient: true,
        archived_at: new Date().toISOString(),
      },
    ])
    .select("id, first_name");
  expect(error).toBeNull();
  createdPersonIds.push(...(people ?? []).map((person) => person.id));
  const patientId = people!.find((p) => p.first_name === "Paciente")!.id;
  const archivedId = people!.find((p) => p.first_name === "Archivado")!.id;

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${patientId}`);

  await expect(page.getByRole("main")).toContainText("años · Paciente");
  await expect(page.getByRole("main")).toContainText("Todavía no tiene citas.");
  const newAppointment = page.getByTestId("patient-new-appointment");
  await expect(newAppointment).toHaveAttribute(
    "href",
    `/appointments/new?patient=${patientId}`,
  );
  await newAppointment.click();
  await page.waitForURL(/\/appointments\/new\?patient=/);
  await expect(page.getByTestId("patient-selected")).toContainText(
    `Paciente ${lastName}`,
  );

  await page.getByRole("link", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${patientId}`);

  await page.goto(`${DASHBOARD}/patients/${archivedId}`);
  await expect(page.getByRole("main")).toContainText("Ficha archivada");
  await expect(page.getByTestId("patient-new-appointment")).toHaveCount(0);

  await page.goto(`${DASHBOARD}/patients/a0000000-0000-0000-0000-000000000601`);
  await expect(page.getByRole("main")).toContainText("Tutor/a");
  await expect(page.getByTestId("patient-new-appointment")).toHaveCount(0);
});

test("Pacientes pasa de página sin perder la búsqueda ni el filtro «Archivados», y vuelve atrás igual", async ({
  page,
}) => {
  const lastName = `Paginada${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert(
      Array.from({ length: 27 }, (_, index) => ({
        first_name: `Persona ${String(index + 1).padStart(2, "0")}`,
        last_name: lastName,
        birth_date: "1990-01-01",
        is_patient: true,
        archived_at: new Date().toISOString(),
      })),
    )
    .select("id");
  expect(error).toBeNull();
  createdPersonIds.push(...data!.map((row) => row.id));

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients?q=${lastName}&archived=1`);

  await expect(page.getByTestId("patient-row")).toHaveCount(25);
  await expect(
    page.getByRole("navigation", { name: "Paginación" }),
  ).toContainText("Página 1 de 2");
  await expect(page.getByTestId("patients-prev")).toHaveCount(0);

  await page.getByTestId("patients-next").click();

  await expect(page).toHaveURL(/pagina=2/);
  await expect(page).toHaveURL(new RegExp(`q=${lastName}`));
  await expect(page).toHaveURL(/archived=1/);
  await expect(page.getByTestId("patient-row")).toHaveCount(2);
  await expect(page.getByTestId("patient-row").last()).toContainText(
    "Persona 27",
  );
  await expect(page.getByTestId("patients-search")).toHaveValue(lastName);
  await expect(page.getByTestId("patients-archived")).toBeChecked();

  await page.getByTestId("patients-prev").click();

  await expect(page).not.toHaveURL(/pagina=/);
  await expect(page).toHaveURL(new RegExp(`q=${lastName}`));
  await expect(page.getByTestId("patient-row")).toHaveCount(25);
  await expect(page.getByTestId("patient-row").first()).toContainText(
    "Persona 01",
  );
});

test("a 390 px Pacientes se lee sin desplazar la página de lado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients`);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await table.evaluate((element) => {
      const wrapper = element.parentElement as HTMLElement;
      return wrapper.scrollWidth <= wrapper.clientWidth;
    }),
  ).toBe(true);
});

test("a page past the end of Pacientes says there are no more records and links back to the first page, instead of an error", async ({
  page,
}) => {
  const lastName = `FueraDeRango${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Persona",
      last_name: lastName,
      birth_date: "1990-01-01",
      is_patient: true,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);

  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients?q=${lastName}&pagina=99`);

  await expect(page.getByTestId("patients-error")).toHaveCount(0);
  await expect(page.getByTestId("patients-empty")).toContainText(
    "No hay más fichas.",
  );
  await page.getByRole("link", { name: "Volver a la primera página" }).click();

  await expect(page).not.toHaveURL(/pagina=/);
  await expect(page).toHaveURL(new RegExp(`q=${lastName}`));
  await expect(page.getByTestId("patient-row")).toHaveCount(1);
});

test("archiving a record with an upcoming appointment, even with another professional, is refused and lists it so it is cancelled or moved first", async ({
  page,
}) => {
  const lastName = `ConCita${Date.now()}`;
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
  createdPersonIds.push(person!.id);
  const day = addDays(todayInMadrid(), 120 + Math.floor(Math.random() * 100));
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      professional_id: MARC_ID,
      patient_id: person!.id,
      service_id: FISIOTERAPIA_SERVICE_ID,
      starts_at: `${day} 08:05:00 Europe/Madrid`,
      ends_at: `${day} 08:35:00 Europe/Madrid`,
    })
    .select("id")
    .single();
  expect(appointmentError).toBeNull();
  createdAppointmentIds.push(appointment!.id);

  await loginAsOwner(page);
  await page.goto(`${DASHBOARD}/patients/${person!.id}`);
  await page.getByTestId("person-archive").click();
  await page.getByTestId("confirm-action").click();

  const blocked = page.getByTestId("person-archive-blocked");
  await expect(blocked).toContainText("Cancela o mueve antes estas citas.");
  await expect(page.getByTestId("person-archive-blocked-item")).toHaveText(
    `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)} 08:05 · Marc Ejemplo`,
  );
  const { data: stored } = await admin
    .from("people")
    .select("archived_at")
    .eq("id", person!.id)
    .single();
  expect(stored?.archived_at).toBeNull();
});
