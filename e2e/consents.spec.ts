import { execSync } from "node:child_process";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { extractImages, extractText, getDocumentProxy } from "unpdf";
import { signIn } from "./auth";
import { latestEmailAttachments, latestEmailFor } from "./mail";

const WEB = "http://localhost:3000";
const DASHBOARD = "http://localhost:3001";
const CLINIC_EMAIL = "info@clinicalumia.es";
const SUPABASE = "http://127.0.0.1:54321";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient(SUPABASE, serviceKey ?? "");

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const createdConsentIds: string[] = [];
const createdPdfPaths: string[] = [];
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];
const networkHashes: string[] = [];

const ipSalt =
  readFileSync("../apps/web/.env.development.local", "utf8").match(
    /^ACCESS_IP_SALT="?([^"\n]*)/m,
  )?.[1] ?? "";

function networkHash(ip: string) {
  return createHash("sha256").update(`${ipSalt}:${ip}`).digest("hex");
}

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueTaxId() {
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `${digits}${"TRWAGMYFPDXBNJZSQVHLCKE"[Number(digits) % 23]}`;
}

function todayInMadrid() {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

type Signer = {
  firstName: string;
  lastName: string;
  birthDate: string;
  taxId: string;
  email: string;
  guardian?: string;
  guardianTaxId?: string;
  marketing?: boolean;
  mediaForTraining?: boolean;
};

async function fillSigner(page: Page, signer: Signer) {
  await page.goto(`${WEB}/consentimiento`);
  const form = page.getByTestId("consent-form");
  await form.getByLabel("Nombre", { exact: true }).fill(signer.firstName);
  await form.getByLabel("Apellidos", { exact: true }).fill(signer.lastName);
  if (signer.guardian)
    await form
      .getByLabel("Si es menor: nombre del padre, madre o tutor")
      .fill(signer.guardian);
  await form.getByLabel("Fecha de nacimiento").fill(signer.birthDate);
  await form.getByLabel("DNI/NIE del paciente").fill(signer.taxId);
  if (signer.guardianTaxId)
    await form
      .getByLabel("Si es menor: DNI/NIE del padre, madre o tutor")
      .fill(signer.guardianTaxId);
  await form.getByLabel("Email", { exact: true }).fill(signer.email);
  await form.getByLabel("Web de LUMIA").check();
  await form.getByLabel(/doy mi consentimiento y autorizo/).check();
  if (signer.marketing)
    await form.getByLabel(/Acepto recibir información/).check();
  if (signer.mediaForTraining)
    await form.getByLabel(/Autorizo el uso de mis fotografías/).check();
}

async function storedConsent(taxId: string, column = "tax_id") {
  const { data, error } = await admin
    .from("consents")
    .select("id, pdf_path, person_id, link_method, tax_id, guardian_tax_id")
    .eq(column, taxId)
    .single();
  expect(error).toBeNull();
  createdConsentIds.push(data!.id);
  createdPdfPaths.push(data!.pdf_path);
  return data!;
}

async function storedPdf(path: string) {
  const { data, error } = await admin.storage.from("consents").download(path);
  expect(error).toBeNull();
  const bytes = new Uint8Array(await data!.arrayBuffer());
  const { text } = await extractText(await getDocumentProxy(bytes.slice()), {
    mergePages: true,
  });
  const document = await getDocumentProxy(bytes.slice());
  const images = [];
  for (let number = 1; number <= document.numPages; number++) {
    images.push(...(await extractImages(document, number)));
  }
  return { text, images };
}

async function drawSignature(page: Page) {
  const pad = page.getByTestId("signature-pad");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 30, box!.y + 40);
  await page.mouse.down();
  await page.mouse.move(box!.x + 120, box!.y + 90, { steps: 8 });
  await page.mouse.move(box!.x + 200, box!.y + 50, { steps: 8 });
  await page.mouse.up();
}

async function signAtWeb(page: Page, signer: Signer) {
  await fillSigner(page, signer);
  await drawSignature(page);

  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-success")).toBeVisible();

  return signer.taxId
    ? storedConsent(signer.taxId)
    : storedConsent(signer.guardianTaxId ?? "", "guardian_tax_id");
}

async function loginAsThrowawayEmployee(page: Page) {
  const email = `consents-employee-${uniqueSuffix()}@test.local`;
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
    full_name: "Empleada Consentimientos",
    role: "employee",
    is_active: true,
  });
  expect(profileError).toBeNull();
  await signIn(page, DASHBOARD, email, password);
}

async function createPerson({
  firstName,
  lastName,
  archived = false,
  taxId = null,
  birthDate = "1985-03-03",
}: {
  firstName: string;
  lastName: string;
  archived?: boolean;
  taxId?: string | null;
  birthDate?: string;
}) {
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: firstName,
      last_name: lastName,
      tax_id: taxId,
      birth_date: birthDate,
      is_patient: true,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);
  return data!.id as string;
}

async function createConsent({
  firstName,
  lastName,
  personId = null,
  email = null,
}: {
  firstName: string;
  lastName: string;
  personId?: string | null;
  email?: string | null;
}) {
  const id = randomUUID();
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("consents")
    .upload(path, MINIMAL_PDF, { contentType: "application/pdf" });
  expect(uploadError).toBeNull();
  createdPdfPaths.push(path);
  const taxId = uniqueTaxId();
  const { error } = await admin.from("consents").insert({
    id,
    signed_at: now.toISOString(),
    first_name: firstName,
    last_name: lastName,
    birth_date: "1985-03-03",
    tax_id: taxId,
    email,
    sources: ["Web de LUMIA"],
    marketing: true,
    media_for_training: false,
    pdf_path: path,
    person_id: personId,
    linked_at: personId ? now.toISOString() : null,
    link_method: personId ? "manual" : null,
  });
  expect(error).toBeNull();
  createdConsentIds.push(id);
  return { id, path, taxId };
}

async function searchConsents(page: Page, query: string) {
  await page.getByTestId("consents-search").fill(query);
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
}

test.beforeEach(async ({ page }) => {
  const ip = `198.18.${randomInt(256)}.${randomInt(256)}`;
  networkHashes.push(networkHash(ip));
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

test.afterEach(async () => {
  const errors: unknown[] = [];
  const hashes = networkHashes.splice(0);
  if (hashes.length > 0) {
    const { error } = await admin
      .from("access_requests")
      .delete()
      .in("ip_hash", hashes);
    if (error) errors.push(error);
  }
  const consentIds = createdConsentIds.splice(0);
  if (consentIds.length > 0) {
    const { error } = await admin
      .from("consents")
      .delete()
      .in("id", consentIds);
    if (error) errors.push(error);
  }
  const pdfPaths = createdPdfPaths.splice(0);
  if (pdfPaths.length > 0) {
    const { error } = await admin.storage.from("consents").remove(pdfPaths);
    if (error) errors.push(error);
  }
  const personIds = createdPersonIds.splice(0);
  if (personIds.length > 0) {
    const { error } = await admin.from("people").delete().in("id", personIds);
    if (error) errors.push(error);
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errors.push(error);
  }
  expect(errors).toEqual([]);
});

test("staff see a pending consent first, link it by hand to the right record and can undo it", async ({
  page,
}) => {
  const surname = `Firmante${uniqueSuffix()}`;
  const personId = await createPerson({
    firstName: "Ficha",
    lastName: surname,
  });
  const pending = await createConsent({
    firstName: "Pendiente",
    lastName: surname,
  });
  await createConsent({
    firstName: "Asociada",
    lastName: surname,
    personId,
  });
  await loginAsThrowawayEmployee(page);

  await page.getByRole("link", { name: "Consentimientos" }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos`);
  await expect(page.getByTestId("consents-pending-filter")).toBeChecked();
  await searchConsents(page, surname);

  const rows = page.getByTestId("consents-list").getByTestId("consent-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Pendiente ${surname}`);
  await expect(rows.first()).toContainText(pending.taxId);
  await expect(rows.first().getByTestId("consent-status")).toHaveText(
    "Pendiente de asociar",
  );

  await page.getByTestId("consents-all-filter").check();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("pendientes") === "0",
  );
  await expect(rows).toHaveCount(2);
  await expect(
    rows
      .filter({ hasText: `Asociada ${surname}` })
      .getByTestId("consent-status"),
  ).toHaveText(`Asociado a la ficha de Ficha ${surname}`);

  await rows
    .filter({ hasText: `Pendiente ${surname}` })
    .getByTestId("consent-open")
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos/${pending.id}`);
  await expect(page.getByTestId("consent-details")).toContainText(
    pending.taxId,
  );
  await expect(page.getByTestId("consent-details")).toContainText(
    "Publicidad: Sí",
  );
  await expect(page.getByTestId("consent-details")).toContainText(
    "Imágenes para formación: No",
  );

  const picker = page.getByTestId("consent-link-picker");
  await picker.getByTestId("patient-search").fill(surname);
  const option = page
    .getByTestId("patient-option")
    .filter({ hasText: `Ficha ${surname}` });
  await expect(option).toContainText(/\d+ años/);
  await option.click();
  await page.getByTestId("consent-link").click();

  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Ficha ${surname}`,
  );
  await expect(
    page.getByTestId("consent-status").getByRole("link"),
  ).toHaveAttribute("href", `/patients/${personId}`);
  const { data: linked } = await admin
    .from("consents")
    .select("person_id, link_method")
    .eq("id", pending.id)
    .single();
  expect(linked).toEqual({ person_id: personId, link_method: "manual" });

  await page.getByTestId("consent-unlink").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Pendiente de asociar",
  );
  await expect(page.getByTestId("consent-link-picker")).toBeVisible();
  const { data: unlinked } = await admin
    .from("consents")
    .select("person_id, link_method")
    .eq("id", pending.id)
    .single();
  expect(unlinked).toEqual({ person_id: null, link_method: null });
});

test("the PDF opens only through the short-lived signed link, never through a public URL", async ({
  page,
}) => {
  const consent = await createConsent({
    firstName: "Pdf",
    lastName: `Firmado${uniqueSuffix()}`,
  });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${consent.id}`);

  const pdfLink = page.getByTestId("consent-pdf");
  await expect(pdfLink).toHaveAttribute("target", "_blank");
  await expect(pdfLink).toHaveAttribute("rel", /noopener/);
  const href = await pdfLink.getAttribute("href");
  expect(href).toContain("token=");

  const signed = await page.request.get(href!);
  expect(signed.status()).toBe(200);
  expect(signed.headers()["content-type"]).toContain("application/pdf");
  expect((await signed.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const publicUrl = await page.request.get(
    `${SUPABASE}/storage/v1/object/public/consents/${consent.path}`,
  );
  expect([400, 401, 404]).toContain(publicUrl.status());
});

test("a consent linked to an archived record still says whose it is", async ({
  page,
}) => {
  const surname = `Archivada${uniqueSuffix()}`;
  const personId = await createPerson({
    firstName: "Ficha",
    lastName: surname,
    archived: true,
  });
  const consent = await createConsent({
    firstName: "Firma",
    lastName: surname,
    personId,
  });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${consent.id}`);

  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Ficha ${surname} (ficha archivada)`,
  );
  await expect(page.getByTestId("consent-unlink")).toBeVisible();
});

test("an unknown consent id shows the not-found page instead of an empty detail", async ({
  page,
}) => {
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${randomUUID()}`);
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByTestId("consent-details")).toHaveCount(0);
});

test("an address that is not a consent id shows the not-found page instead of a load error", async ({
  page,
}) => {
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/no-es-un-id`);
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test("the search box follows the address when staff navigate, so it never shows a filter that is not applied", async ({
  page,
}) => {
  const surname = `Navegacion${uniqueSuffix()}`;
  await createConsent({ firstName: "Pendiente", lastName: surname });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos`);
  await searchConsents(page, surname);
  await page.getByTestId("consents-all-filter").check();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("pendientes") === "0",
  );

  await page.getByRole("link", { name: "Consentimientos" }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos`);
  await expect(page.getByTestId("consents-search")).toHaveValue("");
  await expect(page.getByTestId("consents-pending-filter")).toBeChecked();

  await page.goBack();
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === surname);
  await expect(page.getByTestId("consents-search")).toHaveValue(surname);
  await expect(page.getByTestId("consents-pending-filter")).not.toBeChecked();
  await expect(
    page.getByTestId("consents-list").getByTestId("consent-row"),
  ).toHaveCount(1);
});

test("a patient who signs at the web with the DNI and birth date of their record sees it in that record, and the clinic gets the PDF by email", async ({
  page,
}) => {
  const surname = `Web${uniqueSuffix()}`;
  const taxId = uniqueTaxId();
  const personId = await createPerson({
    firstName: "Lucia",
    lastName: surname,
    taxId,
    birthDate: "1990-04-12",
  });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/patients/${personId}`);
  await expect(page.getByTestId("patient-consents")).toContainText(
    "Sin consentimientos firmados",
  );

  const consent = await signAtWeb(page, {
    firstName: "Lucia",
    lastName: surname,
    birthDate: "1990-04-12",
    taxId,
    email: `firma-${uniqueSuffix()}@test.local`,
    marketing: true,
  });
  expect(consent).toMatchObject({
    person_id: personId,
    link_method: "auto_tax_id",
  });
  const { text } = await storedPdf(consent.pdf_path);
  expect(text).toContain("Firma dibujada");
  expect(text).not.toContain("Firma escrita con el nombre");

  await page.goto(`${DASHBOARD}/patients/${personId}`);
  const item = page
    .getByTestId("patient-consents")
    .getByTestId("patient-consent");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(todayInMadrid());
  await expect(item).toContainText("Publicidad: Sí");
  await expect(item).toContainText("Imágenes para formación: No");
  const pdfLink = item.getByTestId("patient-consent-pdf");
  await expect(pdfLink).toHaveText("Ver PDF");
  await expect(pdfLink).toHaveAttribute("target", "_blank");
  const pdf = await page.request.get((await pdfLink.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const attachments = await latestEmailAttachments(
    CLINIC_EMAIL,
    `Lucia ${surname}`,
  );
  expect(attachments).toEqual([
    expect.stringMatching(
      new RegExp(`^consentimiento-${taxId}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`),
    ),
  ]);
});

test("a patient who would rather not draw signs by typing their name, and the PDF says the signature was typed", async ({
  page,
}) => {
  const surname = `Escrita${uniqueSuffix()}`;
  const taxId = uniqueTaxId();
  await fillSigner(page, {
    firstName: "Lucia",
    lastName: surname,
    birthDate: "1990-04-12",
    taxId,
    email: `escrita-${uniqueSuffix()}@test.local`,
  });
  const form = page.getByTestId("consent-form");
  const typed = page.getByTestId("signature-typed-input");
  const preview = page.getByTestId("signature-typed-preview");

  await expect(page.getByTestId("signature-mode-draw")).toBeChecked();
  await page.getByTestId("signature-mode-type").check();
  await expect(page.getByTestId("signature-pad")).toBeHidden();
  await expect(typed).toHaveValue(`Lucia ${surname}`);
  await expect(preview).toHaveText(`Lucia ${surname}`);

  await form.getByLabel("Apellidos", { exact: true }).fill(`${surname} Ferrer`);
  await expect(typed).toHaveValue(`Lucia ${surname} Ferrer`);

  await typed.fill("");
  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-error")).toHaveText("Falta la firma.");

  await typed.fill(`Lucía ${surname}`);
  await form.getByLabel("Apellidos", { exact: true }).fill(surname);
  await expect(typed).toHaveValue(`Lucía ${surname}`);
  await expect(preview).toHaveText(`Lucía ${surname}`);

  await page.getByTestId("signature-mode-draw").check();
  await expect(page.getByTestId("signature-pad")).toBeVisible();
  await page.getByTestId("signature-mode-type").check();
  await expect(typed).toHaveValue(`Lucía ${surname}`);

  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-success")).toBeVisible();

  const consent = await storedConsent(taxId);
  const { text, images } = await storedPdf(consent.pdf_path);
  expect(text).toContain("Firma escrita con el nombre");
  expect(text).not.toContain("Firma dibujada");
  expect(images).toHaveLength(1);
  expect(images[0]!.data.some((value) => value > 0)).toBe(true);
});

test("a consent from someone new waits as pending until staff create the record from it, never copying the guardian's DNI into the minor's record, and cancelling keeps it pending", async ({
  page,
}) => {
  const surname = `Nueva${uniqueSuffix()}`;
  const guardianTaxId = uniqueTaxId();
  const email = `nueva-${uniqueSuffix()}@test.local`;
  const consent = await signAtWeb(page, {
    firstName: "Martina",
    lastName: surname,
    birthDate: "2015-06-20",
    taxId: "",
    guardianTaxId,
    email,
    guardian: "Carmen Tutora",
    mediaForTraining: true,
  });
  expect(consent).toMatchObject({ person_id: null, link_method: null });

  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${consent.id}`);
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Pendiente de asociar",
  );
  await page.getByTestId("consent-create-person").click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/patients/new?consentimiento=${consent.id}`,
  );
  const form = page.getByTestId("person-form");
  await expect(form.getByLabel("Nombre")).toHaveValue("Martina");
  await expect(form.getByLabel("Apellidos")).toHaveValue(surname);
  await expect(form.getByLabel("Fecha de nacimiento")).toHaveValue(
    "20/06/2015",
  );
  await expect(form.getByLabel("DNI/NIE")).toHaveValue("");
  await expect(form).not.toContainText(guardianTaxId);
  await expect(form.getByLabel("Email")).toHaveValue(email);
  await expect(
    form.getByLabel("Es paciente (recibe tratamiento)", { exact: true }),
  ).toBeChecked();
  await expect(form).toContainText("Firmado por: Carmen Tutora");

  await form.getByRole("link", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos/${consent.id}`);
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Pendiente de asociar",
  );

  await page.getByTestId("consent-create-person").click();
  await page.getByTestId("person-submit").click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos/${consent.id}`);
  const { data: person } = await admin
    .from("people")
    .select("id, tax_id")
    .eq("last_name", surname)
    .single();
  createdPersonIds.push(person!.id);
  expect(person!.tax_id).toBeNull();
  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Martina ${surname}`,
  );
  const { data: linked } = await admin
    .from("consents")
    .select("person_id, link_method")
    .eq("id", consent.id)
    .single();
  expect(linked).toEqual({ person_id: person!.id, link_method: "manual" });

  await page.getByTestId("consent-status").getByRole("link").click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${person!.id}`);
  const item = page
    .getByTestId("patient-consents")
    .getByTestId("patient-consent");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Publicidad: No");
  await expect(item).toContainText("Imágenes para formación: Sí");
});

test("a DNI that belongs to a record with another birth date stays pending, and creating a record from it warns about the existing one", async ({
  page,
}) => {
  const surname = `Otra${uniqueSuffix()}`;
  const taxId = uniqueTaxId();
  const personId = await createPerson({
    firstName: "Rosa",
    lastName: surname,
    taxId,
    birthDate: "1970-01-15",
  });
  const consent = await signAtWeb(page, {
    firstName: "Rosa",
    lastName: surname,
    birthDate: "1971-01-15",
    taxId,
    email: `otra-${uniqueSuffix()}@test.local`,
  });
  expect(consent).toMatchObject({ person_id: null, link_method: null });

  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${consent.id}`);
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Pendiente de asociar",
  );
  await page.getByTestId("consent-create-person").click();
  await page.getByTestId("person-submit").click();
  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toContainText(`Rosa ${surname}`);
  await warning.getByTestId("duplicate-use").click();

  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos/${consent.id}`);
  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Rosa ${surname}`,
  );
  const { count } = await admin
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("last_name", surname);
  expect(count).toBe(1);

  await page.goto(`${DASHBOARD}/patients/${personId}`);
  await expect(
    page.getByTestId("patient-consents").getByTestId("patient-consent"),
  ).toHaveCount(1);
});

test("if someone links the consent while staff are creating the record, the record is kept and the consent explains why it was not linked", async ({
  page,
}) => {
  const surname = `Carrera${uniqueSuffix()}`;
  const otherId = await createPerson({ firstName: "Otra", lastName: surname });
  const consent = await createConsent({
    firstName: "Nuevo",
    lastName: surname,
  });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/patients/new?consentimiento=${consent.id}`);
  await expect(
    page.getByTestId("person-form").getByLabel("Apellidos"),
  ).toHaveValue(surname);

  const { error } = await admin
    .from("consents")
    .update({
      person_id: otherId,
      linked_at: new Date().toISOString(),
      link_method: "manual",
    })
    .eq("id", consent.id);
  expect(error).toBeNull();

  await page.getByTestId("person-submit").click();
  await expect(page).toHaveURL(
    `${DASHBOARD}/consentimientos/${consent.id}?linkError=already-linked`,
  );
  const { data: created } = await admin
    .from("people")
    .select("id")
    .eq("tax_id", consent.taxId)
    .single();
  createdPersonIds.push(created!.id);
  await expect(page.getByTestId("consent-action-error")).toHaveText(
    "Este consentimiento ya está asociado.",
  );
  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Otra ${surname}`,
  );
});

test("a 390 px la lista de consentimientos se lee sin desplazar la página de lado", async ({
  page,
}) => {
  const lastName = `Movil${uniqueSuffix()}`;
  await createConsent({ firstName: "Consentimiento", lastName });

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos?pendientes=0`);
  await searchConsents(page, lastName);

  const table = page.getByRole("table");
  await expect(table.getByTestId("consent-row")).toHaveCount(1);
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

test("without captcha keys the consent form shows no captcha", async ({
  page,
}) => {
  await page.goto(`${WEB}/consentimiento`);

  await expect(page.getByTestId("consent-form")).toBeVisible();
  await expect(page.getByTestId("captcha")).toHaveCount(0);
});

test("a sixteenth consent from the same network within an hour is stopped with the clinic phone, so a script cannot fill the list or spend the email quota", async ({
  page,
}) => {
  const { error } = await admin.from("access_requests").insert(
    Array.from({ length: 15 }, () => ({
      email: null,
      ip_hash: networkHashes.at(-1)!,
      kind: "consent",
    })),
  );
  expect(error).toBeNull();
  const taxId = uniqueTaxId();
  await fillSigner(page, {
    firstName: "Familia",
    lastName: `Limite${uniqueSuffix()}`,
    birthDate: "1985-03-01",
    taxId,
    email: `limite-${uniqueSuffix()}@test.local`,
  });
  await page.getByTestId("signature-mode-type").check();
  await page.getByTestId("consent-submit").click();

  await expect(page.getByTestId("consent-error")).toHaveText(
    "Se han enviado muchos consentimientos desde esta conexión. Inténtalo dentro de una hora o llama al 614 552 808.",
  );
  const { data } = await admin
    .from("consents")
    .select("id")
    .eq("tax_id", taxId);
  expect(data).toEqual([]);
});

test("the signer gets a copy of the signed PDF at the email they gave, as proof of what they signed", async ({
  page,
}) => {
  const surname = `Copia${uniqueSuffix()}`;
  const taxId = uniqueTaxId();
  const email = `copia-${uniqueSuffix()}@test.local`;

  await signAtWeb(page, {
    firstName: "Lucia",
    lastName: surname,
    birthDate: "1990-04-12",
    taxId,
    email,
  });

  expect(
    await latestEmailAttachments(email, "Tu consentimiento firmado"),
  ).toEqual([
    expect.stringMatching(
      new RegExp(`^consentimiento-${taxId}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`),
    ),
  ]);
});

test("a minor's consent keeps the patient's and the guardian's DNI apart, the PDF shows both and the guardian gets the copy", async ({
  page,
}) => {
  const surname = `Menor${uniqueSuffix()}`;
  const taxId = uniqueTaxId();
  const guardianTaxId = uniqueTaxId();
  const email = `tutora-${uniqueSuffix()}@test.local`;

  const consent = await signAtWeb(page, {
    firstName: "Leo",
    lastName: surname,
    birthDate: "2016-02-02",
    taxId,
    guardianTaxId,
    email,
    guardian: "Carmen Tutora",
  });

  expect(consent).toMatchObject({
    tax_id: taxId,
    guardian_tax_id: guardianTaxId,
  });
  const { text } = await storedPdf(consent.pdf_path);
  expect(text).toContain(`DNI/NIE del paciente: ${taxId}`);
  expect(text).toContain(`DNI/NIE del padre, madre o tutor: ${guardianTaxId}`);
  expect(await latestEmailFor(email, "Tu consentimiento firmado")).toContain(
    "Carmen Tutora",
  );
});

test("a DNI whose letter does not match is pointed out before sending and refused, while a passport only gets a soft warning and is accepted", async ({
  page,
}) => {
  const surname = `Pasaporte${uniqueSuffix()}`;
  const passport = `PA${String(randomInt(1e7)).padStart(7, "0")}`;
  await fillSigner(page, {
    firstName: "Anna",
    lastName: surname,
    birthDate: "1990-04-12",
    taxId: "12345678A",
    email: "",
  });
  const form = page.getByTestId("consent-form");
  await form.getByLabel("Apellidos", { exact: true }).click();
  await expect(page.getByTestId("consent-dni-hint")).toHaveText(
    "Revisa el DNI/NIE: los números y la letra no coinciden.",
  );
  await drawSignature(page);
  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-error")).toHaveText(
    "El DNI/NIE del paciente no es válido. Revisa los números y la letra.",
  );

  await form.getByLabel("DNI/NIE del paciente").fill(passport);
  await form.getByLabel("Apellidos", { exact: true }).click();
  await expect(page.getByTestId("consent-dni-hint")).toHaveText(
    "Parece un pasaporte. Si tienes DNI o NIE, escríbelo; si no, puedes seguir.",
  );
  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-success")).toBeVisible();
  await storedConsent(passport);
});

test("a consent form sent before the page has loaded its scripts goes by POST, so the DNI and birth date never end up in the address", async ({
  browser,
}) => {
  const ip = `198.18.${randomInt(256)}.${randomInt(256)}`;
  networkHashes.push(networkHash(ip));
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  try {
    const noScript = await context.newPage();
    const methods: string[] = [];
    noScript.on("request", (request) => {
      if (new URL(request.url()).pathname === "/consentimiento")
        methods.push(request.method());
    });
    const taxId = uniqueTaxId();
    await fillSigner(noScript, {
      firstName: "Sin",
      lastName: `Script${uniqueSuffix()}`,
      birthDate: "1990-04-12",
      taxId,
      email: "",
    });
    await noScript.getByTestId("consent-submit").click();
    await noScript.waitForLoadState();

    expect(methods).toContain("POST");
    expect(noScript.url()).toBe(`${WEB}/consentimiento`);
    expect(noScript.url()).not.toContain(taxId);
  } finally {
    await context.close();
  }
});

test("the send button locks from the first click while a typed signature is being prepared, so a double tap cannot send it twice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.fonts.load = () => new Promise(() => {});
  });
  await fillSigner(page, {
    firstName: "Doble",
    lastName: `Toque${uniqueSuffix()}`,
    birthDate: "1990-04-12",
    taxId: uniqueTaxId(),
    email: "",
  });
  await page.getByTestId("signature-mode-type").check();

  await page.getByTestId("consent-submit").click();

  await expect(page.getByTestId("consent-submit")).toBeDisabled();
  await expect(page.getByTestId("consent-submit")).toHaveText("Enviando…");
});

test("when the typed signature cannot be drawn, the signer is told to draw it instead of the button doing nothing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.fonts.load = () => Promise.reject(new Error("sin fuente"));
  });
  await fillSigner(page, {
    firstName: "Fuente",
    lastName: `Rota${uniqueSuffix()}`,
    birthDate: "1990-04-12",
    taxId: uniqueTaxId(),
    email: "",
  });
  await page.getByTestId("signature-mode-type").check();

  await page.getByTestId("consent-submit").click();

  await expect(page.getByTestId("consent-error")).toHaveText(
    "No se ha podido generar la firma. Prueba a dibujarla.",
  );
  await expect(page.getByTestId("consent-submit")).toBeEnabled();
});

test("turning the phone clears the drawn signature with a notice, so a distorted signature never reaches the PDF", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await fillSigner(page, {
    firstName: "Gira",
    lastName: `Movil${uniqueSuffix()}`,
    birthDate: "1990-04-12",
    taxId: uniqueTaxId(),
    email: "",
  });
  await drawSignature(page);

  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByTestId("signature-resized")).toBeVisible();
  await page.getByTestId("consent-submit").click();
  await expect(page.getByTestId("consent-error")).toHaveText("Falta la firma.");
});

test("linking a consent offers to fill what the record is missing, and fills only what staff keep checked", async ({
  page,
}) => {
  const surname = `Completar${uniqueSuffix()}`;
  const personId = await createPerson({
    firstName: "Ficha",
    lastName: surname,
  });
  const email = `completar-${uniqueSuffix()}@test.local`;
  const consent = await createConsent({
    firstName: "Ficha",
    lastName: surname,
    email,
  });
  await loginAsThrowawayEmployee(page);
  await page.goto(`${DASHBOARD}/consentimientos/${consent.id}`);

  await page
    .getByTestId("consent-link-picker")
    .getByTestId("patient-search")
    .fill(surname);
  await page
    .getByTestId("patient-option")
    .filter({ hasText: `Ficha ${surname}` })
    .click();

  const fill = page.getByTestId("consent-fill");
  await expect(page.getByTestId("consent-fill-tax_id")).toBeChecked();
  await expect(fill).toContainText(`DNI/NIE: ${consent.taxId}`);
  await expect(page.getByTestId("consent-fill-email")).toBeChecked();
  await expect(page.getByTestId("consent-fill-birth_date")).toHaveCount(0);
  await page.getByTestId("consent-fill-email").uncheck();
  await page.getByTestId("consent-link").click();

  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a la ficha de Ficha ${surname}`,
  );
  const { data: person } = await admin
    .from("people")
    .select("tax_id, email")
    .eq("id", personId)
    .single();
  expect(person).toEqual({ tax_id: consent.taxId, email: null });
});
