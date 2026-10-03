import { expect, type Locator, type Page, test } from "@playwright/test";

const WEB = "http://localhost:3000";
const AA_NORMAL_TEXT = 4.5;

async function contrastAgainstBackground(
  text: Locator,
  background: Locator,
): Promise<number> {
  const color = await text.evaluate((node) => getComputedStyle(node).color);
  const fill = await background.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  return contrastRatio(color, fill);
}

function contrastRatio(rgbA: string, rgbB: string): number {
  const luminance = (rgb: string) => {
    const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const a = luminance(rgbA);
  const b = luminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function openDesktop(page: Page, path: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${WEB}${path}`);
}

test("every public page offers the same «Pide tu valoración» button in the header and it starts the online booking, so visitors never wonder which button books", async ({
  page,
}) => {
  for (const path of ["/", "/servicios", "/contacto", "/sobre-lumia"]) {
    await openDesktop(page, path);
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Pide tu valoración" }),
    ).toHaveAttribute("href", "/reservar");
  }
});

test("the header no longer shows a «Llamar» button with the WhatsApp logo, which promised a call and opened something else", async ({
  page,
}) => {
  await openDesktop(page, "/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: /Llamar/ }),
  ).toHaveCount(0);
});

test("on inner pages the header links are dark on the sage band so they pass WCAG AA, and the current page is marked", async ({
  page,
}) => {
  await openDesktop(page, "/servicios");
  const banner = page.getByRole("banner");
  const current = banner.getByRole("link", { name: "Servicios", exact: true });

  await expect(current).toHaveAttribute("aria-current", "page");
  expect(
    await contrastAgainstBackground(
      current,
      page.getByTestId("page-hero").locator("div").first(),
    ),
  ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  await expect(
    banner.getByRole("link", { name: "Contacto", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
});

test("the footer shows the address, the hours and how to reach the clinic directly, instead of labels that make people click through to find them", async ({
  page,
}) => {
  await openDesktop(page, "/servicios");
  const footer = page.getByRole("contentinfo");

  await expect(footer).toContainText("Calle Montesa 7");
  await expect(footer).toContainText("46800 Xàtiva");
  await expect(footer).toContainText("15:15");
  await expect(
    footer.getByRole("link", { name: "614 552 808" }),
  ).toHaveAttribute("href", "tel:+34614552808");
  await expect(footer.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/34614552808",
  );
  await expect(
    footer.getByRole("link", { name: "info@clinicalumia.es" }),
  ).toHaveAttribute("href", "mailto:info@clinicalumia.es");
  await expect(
    footer.getByRole("link", { name: "Cómo llegar" }),
  ).toHaveAttribute("href", /google\.com\/maps/);
});

test("the footer links to the privacy policy, which the forms ask people to accept", async ({
  page,
}) => {
  await openDesktop(page, "/");
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Política de privacidad" }),
  ).toHaveAttribute("href", "/privacidad");
});
