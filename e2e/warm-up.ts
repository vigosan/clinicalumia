import { chromium } from "@playwright/test";

const LOGIN_PAGES = [
  "http://localhost:3000/acceder",
  "http://localhost:3001/login",
  "http://localhost:3002/login",
];

const WARM_UP_TIMEOUT_MS = 180_000;

export default async function warmUpLoginPages() {
  const browser = await chromium.launch();
  try {
    await Promise.all(
      LOGIN_PAGES.map(async (url) => {
        const page = await browser.newPage();
        await page.goto(url, { timeout: WARM_UP_TIMEOUT_MS });
        await page
          .locator('[name="email"]')
          .waitFor({ timeout: WARM_UP_TIMEOUT_MS });
        await page.close();
      }),
    );
  } finally {
    await browser.close();
  }
}
