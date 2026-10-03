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

async function textBelowAA(page: Page) {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const canvas = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    const parse = (value: string): Rgba => {
      if (!canvas) throw new Error("No 2D canvas to read colours");
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = value;
      canvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const blend = (top: Rgba, bottom: Rgba): Rgba => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const background = (node: Element | null): Rgba | null => {
      if (!node) return [255, 255, 255, 1];
      const style = getComputedStyle(node);
      if (style.backgroundImage !== "none") return null;
      const fill = parse(style.backgroundColor);
      if (fill[3] === 1) return fill;
      const below = background(node.parentElement);
      if (!below) return null;
      return fill[3] === 0 ? below : blend(fill, below);
    };
    const luminance = ([r, g, b]: Rgba) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const failures: string[] = [];
    for (const element of document.querySelectorAll("main *")) {
      if (element.closest("[data-over-photo], [aria-hidden=true]")) continue;
      const ownText = [...element.childNodes]
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent?.trim())
        .join("");
      if (!ownText) continue;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || style.visibility === "hidden") continue;
      const bg = background(element);
      if (!bg) continue;
      const fg = blend(parse(style.color), bg);
      const size = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const needed = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const measured = ratio(fg, bg);
      if (measured < needed) {
        failures.push(`${ownText.slice(0, 40)} (${measured.toFixed(2)})`);
      }
    }
    return failures;
  });
}

test("every text on the home page meets WCAG AA against its background, so the grey-on-cream copy is readable", async ({
  page,
}) => {
  await openDesktop(page, "/");
  expect(await textBelowAA(page)).toEqual([]);
});

test("the home hero's main button asks for the first assessment and starts the online booking", async ({
  page,
}) => {
  await openDesktop(page, "/");
  await expect(
    page
      .getByTestId("home-hero")
      .getByRole("link", { name: "Pide tu primera valoración" }),
  ).toHaveAttribute("href", "/reservar");
});

test("every service on the home page is one whole link to its page, so the row itself is the target and not a small «Saber más»", async ({
  page,
}) => {
  await openDesktop(page, "/");
  const rows = page.getByTestId("service-list").getByRole("link");

  await expect(rows).toHaveCount(7);
  await expect(rows.first()).toHaveAttribute(
    "href",
    "/terapia-miofuncional-xativa",
  );
  await expect(rows.first()).toContainText("Terapia Miofuncional orofacial");
  await expect(page.getByRole("link", { name: "Saber más" })).toHaveCount(0);
});

test("the home page keeps a short FAQ with the answers folded and a link to all the questions, instead of a wall of open answers", async ({
  page,
}) => {
  await openDesktop(page, "/");
  const faq = page.getByTestId("faq-accordion");

  await expect(faq.locator("details")).toHaveCount(3);
  await expect(faq.locator("details[open]")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Ver todas las preguntas" }),
  ).toHaveAttribute("href", "/preguntas-frecuentes");
});

test("the home page tells visitors where the clinic is with directions and a call button in the same place", async ({
  page,
}) => {
  await openDesktop(page, "/");
  const visit = page.getByRole("region", { name: "Visítanos en Xàtiva" });

  await expect(visit).toContainText("Calle Montesa 7");
  await expect(
    visit.getByRole("link", { name: "Cómo llegar" }),
  ).toHaveAttribute("href", /google\.com\/maps/);
  await expect(visit.getByRole("link", { name: "Llamar" })).toHaveAttribute(
    "href",
    "tel:+34614552808",
  );
});

test("the home page never shows empty grey boxes where Instagram posts should be", async ({
  page,
}) => {
  await openDesktop(page, "/");
  await expect(page.locator("#instagram li:not(:has(a))")).toHaveCount(0);
});

test("every text on the services page meets WCAG AA against its background", async ({
  page,
}) => {
  await openDesktop(page, "/servicios");
  expect(await textBelowAA(page)).toEqual([]);
});

test("the services page groups speech therapy apart from psychology and physiotherapy, and each card opens its treatment", async ({
  page,
}) => {
  await openDesktop(page, "/servicios");
  const main = page.getByRole("main");

  await expect(
    main.getByRole("heading", { name: "Logopedia y terapia miofuncional" }),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "También en LUMIA" }),
  ).toBeVisible();
  const cards = page.getByTestId("service-card");
  await expect(cards).toHaveCount(7);
  await expect(cards.last()).toHaveAttribute("href", "/fisioterapia-xativa");
  await expect(cards.last()).toContainText("Fisioterapia");
});

test("someone who does not know which treatment fits is sent to book a first assessment from the services page", async ({
  page,
}) => {
  await openDesktop(page, "/servicios");
  await expect(
    page
      .getByTestId("service-unsure")
      .getByRole("link", { name: "Pide tu primera valoración" }),
  ).toHaveAttribute("href", "/reservar");
});

test("every text on Somos LUMIA meets WCAG AA, including the sage panel that used to have cream text", async ({
  page,
}) => {
  await openDesktop(page, "/sobre-lumia");
  expect(await textBelowAA(page)).toEqual([]);
});

test("Somos LUMIA puts Patricia's experience and teaching up front as facts and ends by asking for the first assessment", async ({
  page,
}) => {
  await openDesktop(page, "/sobre-lumia");
  const facts = page.getByTestId("about-facts");

  await expect(facts).toContainText("+10 años");
  await expect(facts).toContainText("Instituto Raimon Gaja");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Pide tu primera valoración" }),
  ).toHaveAttribute("href", "/reservar");
});

test("every text on the FAQ page meets WCAG AA against its background", async ({
  page,
}) => {
  await openDesktop(page, "/preguntas-frecuentes");
  expect(await textBelowAA(page)).toEqual([]);
});

test("the FAQ page groups questions by topic with a topic index, so a parent finds the children's questions without reading them all", async ({
  page,
}) => {
  await openDesktop(page, "/preguntas-frecuentes");
  const topics = page.getByRole("navigation", { name: "Temas" });

  await topics.getByRole("link", { name: "Niños" }).click();
  await expect(page).toHaveURL(/#ninos$/);
  const children = page.getByRole("region", { name: "Niños" });
  await expect(children).toContainText(
    "¿Cómo sé si mi hijo respira por la boca?",
  );
  await expect(page.getByRole("region", { name: "Adultos" })).toContainText(
    "¿Trabajáis con adultos?",
  );
});

test("grouping the FAQ keeps every question in the FAQPage structured data that search engines read", async ({
  page,
}) => {
  await openDesktop(page, "/preguntas-frecuentes");
  const questions = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts
        .map((script) => JSON.parse(script.textContent ?? "{}"))
        .filter((data) => data["@type"] === "FAQPage")
        .flatMap((data) =>
          data.mainEntity.map((q: { name: string }) => q.name),
        ),
    );

  expect(questions).toHaveLength(7);
  await expect(
    page.getByTestId("faq-accordion").locator("details"),
  ).toHaveCount(7);
});

test("every text on the contact page meets WCAG AA against its background", async ({
  page,
}) => {
  await openDesktop(page, "/contacto");
  expect(await textBelowAA(page)).toEqual([]);
});

test("the contact page puts calling, WhatsApp and email first, because most people would rather call than fill in a form", async ({
  page,
}) => {
  await openDesktop(page, "/contacto");
  const quick = page.getByTestId("contact-quick");

  await expect(
    quick.getByRole("link", { name: /614 552 808/ }),
  ).toHaveAttribute("href", "tel:+34614552808");
  await expect(quick.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
    "href",
    "https://wa.me/34614552808",
  );
  await expect(
    quick.getByRole("link", { name: /info@clinicalumia\.es/ }),
  ).toHaveAttribute("href", "mailto:info@clinicalumia.es");
});

test("the reason for the visit is chosen from the treatments, with a way out for those who do not know yet", async ({
  page,
}) => {
  await openDesktop(page, "/contacto");
  const reason = page.getByLabel("Motivo de consulta");

  await expect(reason.locator("option")).toContainText([
    "Terapia Miofuncional orofacial",
    "Fisioterapia",
    "No lo sé, necesito orientación",
  ]);
  await reason.selectOption("Logopedia infantil");
  await expect(reason).toHaveValue("Logopedia infantil");
});

test("the access page says plainly what it is and what the account is for, and sends people who are not patients yet to book", async ({
  page,
}) => {
  await openDesktop(page, "/acceder");
  const main = page.getByRole("main");

  await expect(
    main.getByRole("heading", { level: 1, name: "Accede a tu cuenta" }),
  ).toBeVisible();
  await expect(main).toContainText("ver, cambiar o cancelar tus citas");
  await expect(
    main.getByRole("link", { name: "Pide tu primera valoración" }),
  ).toHaveAttribute("href", "/reservar");
  expect(await textBelowAA(page)).toEqual([]);
});

for (const path of [
  "/reservar",
  "/terapia-miofuncional-xativa",
  "/logopedia-infantil-xativa",
  "/logopedia-adultos-xativa",
  "/rehabilitacion-vocal-xativa",
  "/psicologia-xativa",
  "/fisioterapia-xativa",
  "/privacidad",
  "/consentimiento",
  "/esta-pagina-no-existe",
]) {
  test(`every text on ${path} meets WCAG AA against its background, like the rest of the public web`, async ({
    page,
  }) => {
    await openDesktop(page, path);
    expect(await textBelowAA(page)).toEqual([]);
  });
}

test("the booking steps after choosing a specialty also meet WCAG AA", async ({
  page,
}) => {
  await openDesktop(page, "/reservar");
  await page.getByTestId("booking-specialty").first().click();
  await expect(page.getByTestId("booking-step")).toContainText("Paso 2");
  expect(await textBelowAA(page)).toEqual([]);
});

test("each treatment page asks for the first assessment with the same wording and the same destination as the rest of the web", async ({
  page,
}) => {
  await openDesktop(page, "/logopedia-infantil-xativa");
  const main = page.getByRole("main");

  const ctas = main.getByRole("link", { name: "Pide tu primera valoración" });
  await expect(ctas.first()).toHaveAttribute("href", "/reservar");
  await expect(ctas.last()).toHaveAttribute("href", "/reservar");
  await expect(
    main.getByRole("link", {
      name: /Solicita tu primera valoración|Pedir cita/,
    }),
  ).toHaveCount(0);
});

async function openPhone(page: Page, path: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${WEB}${path}`);
}

test("on a phone, calling, WhatsApp and booking stay one tap away at the bottom of the screen while scrolling", async ({
  page,
}) => {
  await openPhone(page, "/servicios");
  const bar = page.getByRole("navigation", { name: "Acciones rápidas" });

  await page.mouse.wheel(0, 1500);
  await expect(bar).toBeInViewport();
  await expect(bar.getByRole("link", { name: "Llamar" })).toHaveAttribute(
    "href",
    "tel:+34614552808",
  );
  await expect(bar.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/34614552808",
  );
  await expect(
    bar.getByRole("link", { name: "Pide tu valoración" }),
  ).toHaveAttribute("href", "/reservar");
});

test("the phone action bar never covers the end of the page, so the footer links can still be tapped", async ({
  page,
}) => {
  await openPhone(page, "/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = await page
    .getByRole("navigation", { name: "Acciones rápidas" })
    .boundingBox();
  const lastLink = await page
    .getByRole("contentinfo")
    .getByRole("link")
    .last()
    .boundingBox();

  expect(lastLink && bar && lastLink.y + lastLink.height).toBeLessThanOrEqual(
    bar?.y ?? 0,
  );
});

test("the phone action bar stays out of the booking and access forms, where it would cover their own buttons, and out of desktop", async ({
  page,
}) => {
  await openPhone(page, "/reservar");
  await expect(
    page.getByRole("navigation", { name: "Acciones rápidas" }),
  ).toHaveCount(0);

  await openDesktop(page, "/");
  await expect(
    page.getByRole("navigation", { name: "Acciones rápidas" }),
  ).toBeHidden();
});
