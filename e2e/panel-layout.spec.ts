import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";
const OWNER = "info@clinicalumia.es";

test.use({ viewport: { width: 1440, height: 900 } });

test("the week fits on a laptop screen, so Sunday is never cut off behind a horizontal scroll", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/?view=week`);

  const grid = page.getByTestId("week-grid");
  await expect(grid).toBeVisible();
  const { scrollWidth, clientWidth } = await grid.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("the day's columns share the whole card, so the agenda doesn't leave half of it empty", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/?view=day`);

  const grid = page.getByTestId("day-grid");
  await expect(grid).toBeVisible();
  const { columnsEnd, contentWidth } = await grid.evaluate((element) => {
    const columns = element.querySelectorAll<HTMLElement>(
      '[data-testid="agenda-column"]',
    );
    const last = columns[columns.length - 1];
    return {
      columnsEnd: last ? last.offsetLeft + last.offsetWidth : 0,
      contentWidth: element.scrollWidth,
    };
  });
  expect(Math.abs(contentWidth - columnsEnd)).toBeLessThanOrEqual(2);
});

test("the agenda toolbar stays together, so «Nueva cita» never drops to a row of its own on the long week title", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/?view=week`);

  await expect(page.getByTestId("agenda-today")).toBeVisible();
  const today = await page.getByTestId("agenda-today").boundingBox();
  const create = await page.getByTestId("agenda-new").boundingBox();
  expect(today && create).toBeTruthy();
  expect(
    Math.abs(today!.y + today!.height / 2 - (create!.y + create!.height / 2)),
  ).toBeLessThanOrEqual(2);
});

test("the owner's week names the person once, in the selected chip, instead of repeating it under the chips", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/?view=week`);

  const selected = page.locator(
    '[data-testid="week-person"][aria-current="page"]',
  );
  const name = (await selected.textContent())?.trim() ?? "";
  expect(name).not.toBe("");
  await expect(
    page.getByRole("main").getByText(name, { exact: true }),
  ).toHaveCount(1);
});
