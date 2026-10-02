import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";
const OWNER = "info@clinicalumia.es";

test.use({ viewport: { width: 1440, height: 900 } });

async function openPendingAppointment(page: Page) {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/cobros?tab=pendientes`);
  const row = page.getByTestId("pending-payment-row").first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  await row.click({
    force: true,
    position: { x: (box?.width ?? 0) * 0.55, y: (box?.height ?? 0) / 2 },
  });
  const panel = page.getByTestId("appointment-panel");
  await expect(panel).toBeVisible();
  await panel.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  return panel;
}

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

test("pending amounts line up on the right with fixed-width digits, so they can be compared at a glance", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/cobros?tab=pendientes`);

  const amounts = page.getByTestId("pending-payment-amount");
  await expect(amounts.first()).toBeVisible();
  for (const amount of await amounts.all()) {
    const style = await amount.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        align: computed.textAlign,
        digits: computed.fontVariantNumeric,
      };
    });
    expect(style.align).toBe("right");
    expect(style.digits).toContain("tabular-nums");
  }
});

test("the appointment sheet is 440 px wide with 24/28 padding over a light veil without blur, so the agenda behind it can still be read", async ({
  page,
}) => {
  const panel = await openPendingAppointment(page);

  const sheet = await panel.evaluate((element) => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      width: box.width,
      right: box.right,
      top: computed.paddingTop,
      bottom: computed.paddingBottom,
      left: computed.paddingLeft,
      inlineEnd: computed.paddingRight,
    };
  });
  expect(sheet).toEqual({
    width: 440,
    right: 1440,
    top: "24px",
    bottom: "24px",
    left: "28px",
    inlineEnd: "28px",
  });

  const veil = await page
    .getByTestId("drawer-overlay")
    .evaluate((element) => getComputedStyle(element));
  expect(veil.backdropFilter).toBe("none");
  expect(veil.backgroundColor).toMatch(/[ ,/] ?0\.2\)$/);

  const panelBox = await panel.boundingBox();
  const actions = await page
    .getByTestId("appointment-panel-actions")
    .boundingBox();
  expect(actions?.x).toBe((panelBox?.x ?? 0) + 1);
  expect((actions?.x ?? 0) + (actions?.width ?? 0)).toBe(1440);
  expect((actions?.y ?? 0) + (actions?.height ?? 0)).toBe(900);
});

test("clicking anywhere on a pending row opens its appointment, not only on the underlined date", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/cobros?tab=pendientes`);

  const row = page.getByTestId("pending-payment-row").first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  await row.click({
    force: true,
    position: { x: (box?.width ?? 0) * 0.55, y: (box?.height ?? 0) / 2 },
  });

  await expect(page).toHaveURL(/[?&]appointment=/);
  await expect(page.getByTestId("appointment-panel")).toBeVisible();
});

test("clicking anywhere on a patient row opens the record", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/patients`);

  const row = page.getByTestId("patient-row").first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  await row.click({
    force: true,
    position: { x: (box?.width ?? 0) - 24, y: (box?.height ?? 0) / 2 },
  });

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the appointment sheet rises from the bottom as a 92 % sheet with 20 px top corners and a 36×5 grabber, with its actions flush at the foot", async ({
    page,
  }) => {
    const panel = await openPendingAppointment(page);

    const sheet = await panel.evaluate((element) => {
      const computed = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        width: box.width,
        bottom: box.bottom,
        height: box.height,
        corner: computed.borderTopLeftRadius,
        otherCorner: computed.borderTopRightRadius,
      };
    });
    expect(sheet.left).toBe(0);
    expect(sheet.width).toBe(390);
    expect(sheet.bottom).toBe(844);
    expect(sheet.height).toBeCloseTo(844 * 0.92, 0);
    expect(sheet.corner).toBe("20px");
    expect(sheet.otherCorner).toBe("20px");

    const grabber = panel.getByTestId("drawer-grabber");
    await expect(grabber).toHaveAttribute("aria-hidden", "true");
    const grabberBox = await grabber.boundingBox();
    expect(grabberBox?.width).toBe(36);
    expect(grabberBox?.height).toBe(5);
    expect((grabberBox?.x ?? 0) + (grabberBox?.width ?? 0) / 2).toBeCloseTo(
      195,
      0,
    );

    const actions = await page
      .getByTestId("appointment-panel-actions")
      .boundingBox();
    expect(actions?.x).toBe(0);
    expect(actions?.width).toBe(390);
    expect((actions?.y ?? 0) + (actions?.height ?? 0)).toBe(844);
  });

  test("patients read as a compact list, so many more fit on one screen than with label/value cards", async ({
    page,
  }) => {
    await signIn(page, DASHBOARD, OWNER);
    await page.goto(`${DASHBOARD}/patients`);

    const rows = page.getByTestId("patient-row");
    await expect(rows.first()).toBeVisible();
    for (const row of (await rows.all()).slice(0, 5)) {
      const box = await row.boundingBox();
      expect(box?.height ?? 0).toBeLessThanOrEqual(80);
    }
  });

  test("a pending payment shows the amount on the patient's line, so the money is read with the name", async ({
    page,
  }) => {
    await signIn(page, DASHBOARD, OWNER);
    await page.goto(`${DASHBOARD}/cobros?tab=pendientes`);

    const row = page.getByTestId("pending-payment-row").first();
    await expect(row).toBeVisible();
    const name = await row.getByTestId("pending-payment-patient").boundingBox();
    const amount = await row
      .getByTestId("pending-payment-amount")
      .boundingBox();
    expect(name && amount).toBeTruthy();
    expect(Math.abs(name!.y - amount!.y)).toBeLessThanOrEqual(4);
    expect(amount!.x).toBeGreaterThanOrEqual(name!.x + name!.width);
  });
});

test("the record lists each detail under its own label, so staff scan by label instead of reading «DNI/NIE: —» lines", async ({
  page,
}) => {
  await signIn(page, DASHBOARD, OWNER);
  await page.goto(`${DASHBOARD}/patients`);
  await page.getByTestId("patient-link").first().click();

  const details = page.getByTestId("patient-details");
  for (const label of ["DNI/NIE", "Email", "Teléfono", "Dirección"]) {
    await expect(
      details.getByRole("term").filter({ hasText: label }),
    ).toHaveCount(1);
  }
  await expect(details.getByRole("definition")).toHaveCount(
    await details.getByRole("term").count(),
  );
});
