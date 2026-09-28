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
