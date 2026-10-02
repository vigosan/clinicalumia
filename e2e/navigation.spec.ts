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

async function createPerson(): Promise<{ id: string; name: string }> {
  const lastName = `Migas${Date.now()}`;
  const { data, error } = await admin
    .from("people")
    .insert({
      first_name: "Nora",
      last_name: lastName,
      is_patient: true,
      birth_date: "1990-04-12",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdPersonIds.push(data!.id);
  return { id: data!.id, name: `Nora ${lastName}` };
}

test.afterEach(async () => {
  if (createdPersonIds.length > 0) {
    const ids = createdPersonIds.splice(0);
    const { error } = await admin.from("people").delete().in("id", ids);
    expect(error).toBeNull();
  }
});

test("the record's breadcrumbs show where staff are and take them back up without the browser's back button", async ({
  page,
}) => {
  const person = await createPerson();
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/${person.id}/edit`);

  await expect(page).toHaveTitle("Editar ficha · LUMIA");
  const trail = page.getByTestId("breadcrumbs");
  await expect(trail).toContainText("Pacientes");
  await expect(trail).toContainText(person.name);
  await expect(trail.getByText("Editar", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await trail.getByRole("link", { name: person.name }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients/${person.id}`);
  await expect(page).toHaveTitle(`${person.name} · LUMIA`);

  await page
    .getByTestId("breadcrumbs")
    .getByRole("link", { name: "Pacientes" })
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/patients`);
  await expect(
    page
      .getByRole("navigation", { name: "Secciones" })
      .getByRole("link", { name: "Pacientes" }),
  ).toHaveAttribute("aria-current", "page");
});

test("an old Nueva cita link opens the drawer on that day's agenda, and closing it stays on the same day", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/appointments/new?date=2026-11-09`);

  await expect(page.getByTestId("new-appointment-drawer")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Secciones", includeHidden: true })
      .getByRole("link", { name: "Agenda", includeHidden: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByTestId("new-appointment-drawer")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await expect(page).toHaveURL(`${DASHBOARD}/?date=2026-11-09`);
});

test("the user menu holds the phone calendar link, not the sections", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");

  await expect(
    page
      .getByRole("navigation", { name: "Secciones" })
      .getByRole("link", { name: /calendario/i }),
  ).toHaveCount(0);
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "Ver citas en mi móvil" }).click();
  await expect(page).toHaveURL(`${DASHBOARD}/mi-calendario`);
  await expect(
    page.getByRole("heading", { name: "Tus citas en el calendario del móvil" }),
  ).toBeVisible();
});

test("signing out from the user menu ends the session", async ({ page }) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");

  await page.getByTestId("user-menu").click();
  await expect(
    page.getByRole("menuitem", { name: "Cerrar sesión" }),
  ).toBeVisible();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(`${DASHBOARD}/patients`);
  await expect(page).toHaveURL(/\/login$/);
});

test("keyboard users open the user menu, reach the phone calendar link and close the menu with Escape", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");

  await page.getByTestId("user-menu").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("user-menu-calendar")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByTestId("user-menu")).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("user-menu-calendar")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${DASHBOARD}/mi-calendario`);
});

test("a broken guardian link opens a plain Nuevo paciente, and the tab title says the same", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/new?guardianOf=no-es-un-id`);
  await expect(
    page.getByRole("heading", { name: "Nuevo paciente" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Nuevo paciente · LUMIA");
});

test("a missing record tells staff in the tab title too, not only on the page", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, "psicologia@lumia.test");
  await page.goto(`${DASHBOARD}/patients/00000000-0000-4000-8000-000000000000`);
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page).toHaveTitle("Página no encontrada · LUMIA");
});

test.describe("on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the sections open in a side menu, and the breadcrumbs shrink to a back link to the parent", async ({
    page,
  }) => {
    const person = await createPerson();
    await signIn(page, DASHBOARD, "psicologia@lumia.test");

    await expect(
      page.getByRole("navigation", { name: "Secciones" }),
    ).toBeHidden();
    await page.getByTestId("nav-toggle").click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await menu.getByRole("link", { name: "Pacientes" }).click();
    await expect(page).toHaveURL(`${DASHBOARD}/patients`);
    await expect(menu).toBeHidden();

    await page.getByTestId("nav-toggle").click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByTestId("nav-toggle")).toBeFocused();

    await page.goto(`${DASHBOARD}/patients/${person.id}/edit`);
    const back = page.getByTestId("breadcrumbs-back");
    await expect(back).toBeVisible();
    await expect(back).toContainText(person.name);
    await back.click();
    await expect(page).toHaveURL(`${DASHBOARD}/patients/${person.id}`);

    await page.getByTestId("user-menu").click();
    await expect(
      page.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeVisible();
  });
});
