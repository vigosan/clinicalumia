import { expect, type Locator } from "@playwright/test";

export async function pickDate(trigger: Locator, date: string) {
  await trigger.click();
  const calendar = trigger
    .page()
    .getByRole("dialog")
    .filter({ has: trigger.page().locator("[data-day]") });
  const day = calendar.locator(`[data-day="${date}"]:not([data-outside])`);
  for (let step = 0; step < 24 && (await day.count()) === 0; step++) {
    const shown = await calendar
      .locator("[data-day]:not([data-outside])")
      .first()
      .getAttribute("data-day");
    await calendar
      .getByRole("button", {
        name: date > (shown ?? "") ? /mes siguiente/i : /mes anterior/i,
      })
      .click();
  }
  await day.getByRole("button").click();
  await expect(calendar).toBeHidden();
}

export async function pickTime(input: Locator, time: string) {
  await input.fill(time);
  await input.press("Enter");
  await expect(input).toHaveValue(time);
  await expect(input).toHaveAttribute("aria-expanded", "false");
}
