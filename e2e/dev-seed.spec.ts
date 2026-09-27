import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const ADMIN = "http://localhost:3002";

test("the seeded owner logs into the admin and sees the Secciones navigation", async ({
  page,
}) => {
  await signIn(page, ADMIN, "info@clinicalumia.es");
  await expect(
    page.getByRole("navigation", { name: "Secciones" }),
  ).toBeVisible();
});

test("two back-to-back logins for the same seeded account, in different contexts, both get past the second step", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    await signIn(pageA, ADMIN, "info@clinicalumia.es");
    await expect(
      pageA.getByRole("navigation", { name: "Secciones" }),
    ).toBeVisible();

    const pageB = await contextB.newPage();
    await signIn(pageB, ADMIN, "info@clinicalumia.es");
    await expect(
      pageB.getByRole("navigation", { name: "Secciones" }),
    ).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
