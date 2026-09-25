import { expect, test } from "@playwright/test";

const pages = ["/", "/servicios", "/contacto", "/consentimiento"];
const widths = [1920, 1440, 390];

function snapshotName(path: string, width: number) {
  const slug = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
  return `web-${slug}-${width}.png`;
}

for (const path of pages) {
  for (const width of widths) {
    test(`web ${path} at ${width}px looks exactly as before moving tokens and fonts`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://localhost:3000${path}`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        window.scrollTo(0, 0);
        await document.fonts.ready;
      });
      await expect(page).toHaveScreenshot(snapshotName(path, width), {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}
