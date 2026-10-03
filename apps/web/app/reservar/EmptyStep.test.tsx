import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyStep } from "./EmptyStep";

const html = renderToStaticMarkup(<EmptyStep />);

describe("EmptyStep", () => {
  it("says there are no online slots right now instead of leaving the visitor at a dead end", () => {
    expect(html).toContain("Ahora mismo no quedan huecos para reservar online");
  });

  it("offers calling, WhatsApp and a call-back form, so every visitor still has a way to get an appointment", () => {
    expect(html).toContain('href="tel:+34614552808"');
    expect(html).toContain('href="https://wa.me/34614552808"');
    expect(html).toContain('href="/contacto"');
  });

  it("points existing patients to Mi cuenta, where they manage the appointments they already have", () => {
    expect(html).toContain('href="/mi-cuenta"');
  });
});
