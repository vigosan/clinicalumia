import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";
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

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueTaxId() {
  return `${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}Z`;
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
}: {
  firstName: string;
  lastName: string;
  archived?: boolean;
}) {
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: firstName,
      last_name: lastName,
      birth_date: "1985-03-03",
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
}: {
  firstName: string;
  lastName: string;
  personId?: string | null;
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
    email: null,
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

test.afterEach(async () => {
  if (createdConsentIds.length > 0) {
    const { error } = await admin
      .from("consents")
      .delete()
      .in("id", createdConsentIds.splice(0));
    expect(error).toBeNull();
  }
  if (createdPdfPaths.length > 0) {
    const { error } = await admin.storage
      .from("consents")
      .remove(createdPdfPaths.splice(0));
    expect(error).toBeNull();
  }
  if (createdPersonIds.length > 0) {
    const { error } = await admin
      .from("people")
      .delete()
      .in("id", createdPersonIds.splice(0));
    expect(error).toBeNull();
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
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

  await page.getByTestId("consents-pending-filter").uncheck();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("pendientes") === "0",
  );
  await expect(rows).toHaveCount(2);
  await expect(
    rows
      .filter({ hasText: `Asociada ${surname}` })
      .getByTestId("consent-status"),
  ).toHaveText(`Asociado a Ficha ${surname}`);

  await rows
    .filter({ hasText: `Pendiente ${surname}` })
    .getByTestId("consent-open")
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/consentimientos/${pending.id}`);
  await expect(page.getByTestId("consent-details")).toContainText(
    pending.taxId,
  );
  await expect(page.getByTestId("consent-details")).toContainText(
    "Publicidad: sí",
  );
  await expect(page.getByTestId("consent-details")).toContainText(
    "Imágenes para formación: no",
  );

  const picker = page.getByTestId("consent-link-picker");
  await picker.getByTestId("patient-search").fill(surname);
  await picker
    .getByTestId("patient-option")
    .filter({ hasText: `Ficha ${surname}` })
    .click();
  await page.getByTestId("consent-link").click();

  await expect(page.getByTestId("consent-status")).toHaveText(
    `Asociado a Ficha ${surname}`,
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
    `Asociado a Ficha ${surname} (archivada)`,
  );
  await expect(page.getByTestId("consent-unlink")).toBeVisible();
});

test("an unknown consent id shows the not-found page instead of an empty detail", async ({
  page,
}) => {
  await loginAsThrowawayEmployee(page);
  const response = await page.goto(
    `${DASHBOARD}/consentimientos/${randomUUID()}`,
  );
  expect(response?.status()).toBe(404);
});
