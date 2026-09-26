import { expect, test } from "@playwright/test";

test("the seeded owner logs into the admin and sees the Secciones navigation", async ({
  page,
}) => {
  await page.goto("http://localhost:3002/login");
  await page.fill('[name="email"]', "propietaria@lumia.test");
  await page.fill('[name="password"]', "lumia-desarrollo-2026");
  await page.getByTestId("login-submit").click();
  await expect(
    page.getByRole("navigation", { name: "Secciones" }),
  ).toBeVisible();
});
