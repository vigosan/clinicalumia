import { describe, expect, it } from "vitest";
import { consentClauses } from "./consent-legal";
import { PENDING } from "./site";

const legalText = consentClauses.join(" ");

describe("consent legal text", () => {
  it("has no pending placeholders, because patients must never sign an unfinished document", () => {
    expect(legalText).not.toContain(PENDING);
  });

  it("identifies the data controller, as the RGPD requires", () => {
    expect(legalText).toContain("Patricia Hernán Sánchez");
    expect(legalText).toContain("20449989E");
    expect(legalText).toContain("Calle Montesa 7, 46800 Xàtiva (Valencia)");
  });

  it("cites the laws in force instead of the repealed LOPD 15/1999", () => {
    expect(legalText).toContain("Reglamento (UE) 2016/679");
    expect(legalText).toContain("Ley Orgánica 3/2018");
    expect(legalText).not.toContain("15/1999");
  });
});
