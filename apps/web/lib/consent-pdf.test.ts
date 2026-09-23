import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Consent } from "./consent";
import { buildConsentPdf } from "./consent-pdf";

const consent: Consent = {
  firstName: "Ana",
  lastName: "García López",
  guardian: "",
  birthDate: "1990-05-10",
  dni: "12345678Z",
  email: "ana@example.com",
  sources: ["Familiares o amigos"],
  marketing: false,
  mediaForTraining: false,
  signature:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAEElEQVR4nGNgYGD4j4ZRBQB7pgf5fzpslgAAAABJRU5ErkJggg==",
};
const signedAt = new Date("2026-09-22T10:30:00Z");

function countImages(pdf: PDFDocument) {
  return pdf.context
    .enumerateIndirectObjects()
    .filter(
      ([, object]) =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
    ).length;
}

describe("buildConsentPdf", () => {
  it("produces a PDF identifiable by patient, so it can be filed and found later", async () => {
    const pdf = await PDFDocument.load(
      await buildConsentPdf(consent, signedAt),
    );
    expect(pdf.getTitle()).toBe(
      "Consentimiento de protección de datos · Ana García López",
    );
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("embeds the handwritten signature, which is what makes it a signed document", async () => {
    const pdf = await PDFDocument.load(
      await buildConsentPdf(consent, signedAt),
    );
    expect(countImages(pdf)).toBe(1);
  });

  it("does not lose a consent because a name has characters outside the PDF base font", async () => {
    const foreign = { ...consent, firstName: "Łukasz", lastName: "Nguyễn 李" };
    const bytes = await buildConsentPdf(foreign, signedAt);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("rejects a signature that is not a real image instead of producing an unsigned PDF", async () => {
    const broken = { ...consent, signature: "data:image/png;base64,AAAA" };
    await expect(buildConsentPdf(broken, signedAt)).rejects.toThrow();
  });
});
