import type { createAdminClient } from "@clinicalumia/api/admin";
import { describe, expect, it, vi } from "vitest";
import type { Consent } from "@/lib/consent";
import { buildConsentPdf } from "@/lib/consent-pdf";
import {
  importConsents,
  parseConsentText,
  readPdfText,
} from "./consent-import";
import { buildConsentPdf as buildConsentPdfV2 } from "./fixtures/consent-pdf-39d8223";
import { buildConsentPdf as buildConsentPdfV1 } from "./fixtures/consent-pdf-2599666";

type AdminClient = ReturnType<typeof createAdminClient>;

const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAEElEQVR4nGNgYGD4j4ZRBQB7pgf5fzpslgAAAABJRU5ErkJggg==";

const minor: Consent = {
  firstName: "Lucía",
  lastName: "Martínez Ferrer",
  guardian: "Carmen Ferrer Soler",
  birthDate: "2016-03-04",
  dni: "12345678Z",
  email: "familia@example.com",
  sources: ["Internet (Google, etc.)", "Otros"],
  marketing: true,
  mediaForTraining: false,
  signature,
};

const adult: Consent = {
  firstName: "Ana",
  lastName: "García López",
  guardian: "",
  birthDate: "1990-05-10",
  dni: "87654321X",
  email: "",
  sources: ["Familiares o amigos"],
  marketing: false,
  mediaForTraining: true,
  signature,
};

const summerSignature = new Date("2026-09-22T10:30:00Z");
const winterSignature = new Date("2026-01-15T08:05:00Z");

async function pdfText(consent: Consent, signedAt: Date) {
  return readPdfText(await buildConsentPdf(consent, signedAt));
}

function withoutSignature({ signature: _, ...consent }: Consent) {
  return consent;
}

describe("parseConsentText", () => {
  it("recovers the data of a minor's consent exactly as it was signed, so it can be filed like a new one", async () => {
    const result = parseConsentText(await pdfText(minor, summerSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(withoutSignature(result.consent)).toEqual(withoutSignature(minor));
    expect(result.signedAt).toEqual(summerSignature);
  });

  it("reads blank email and guardian as empty, not as the dash printed in their place", async () => {
    const result = parseConsentText(await pdfText(adult, winterSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(withoutSignature(result.consent)).toEqual(withoutSignature(adult));
  });

  it("converts the Madrid wall-clock time printed in winter back to the real instant", async () => {
    const result = parseConsentText(await pdfText(adult, winterSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(result.signedAt).toEqual(winterSignature);
  });

  it("keeps every source even when the list wraps onto a second line", async () => {
    const all = {
      ...adult,
      sources: [
        "Familiares o amigos",
        "Web de LUMIA",
        "Internet (Google, etc.)",
        "Instagram u otras redes sociales",
        "Otros",
      ],
    };

    const result = parseConsentText(await pdfText(all, summerSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(result.consent.sources).toEqual(all.sources);
  });

  it("reads the signature date even when a long guardian name wraps the signed line", async () => {
    const long = {
      ...minor,
      guardian:
        "María de los Ángeles Fernández de Córdoba y Martínez de la Rosa Villanueva",
    };

    const result = parseConsentText(await pdfText(long, summerSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(result.consent.guardian).toBe(long.guardian);
    expect(result.signedAt).toEqual(summerSignature);
  });

  it("normalizes a DNI written with dots and lowercase, so it matches the same person as the web", async () => {
    const dotted = { ...adult, dni: "87.654.321-x" };

    const result = parseConsentText(await pdfText(dotted, summerSignature));

    if (!("ok" in result)) throw new Error(result.error);
    expect(result.consent.dni).toBe("87654321X");
  });

  it.each([
    [
      "the first version, without media authorization",
      buildConsentPdfV1,
      false,
    ],
    ["the version that added media authorization", buildConsentPdfV2, true],
  ])("reads consents signed with %s, whose legal text was different", async (_, build, hasMedia) => {
    const all = {
      ...minor,
      mediaForTraining: true,
      sources: [
        "Familiares o amigos",
        "Web de LUMIA",
        "Internet (Google, etc.)",
        "Instagram u otras redes sociales",
        "Otros",
      ],
    };

    const result = parseConsentText(
      await readPdfText(await build(all, summerSignature)),
    );

    if (!("ok" in result)) throw new Error(result.error);
    expect(withoutSignature(result.consent)).toEqual(
      withoutSignature({ ...all, mediaForTraining: hasMedia }),
    );
    expect(result.signedAt).toEqual(summerSignature);
  });

  it("reads an unchecked marketing box in the first version as no marketing", async () => {
    const result = parseConsentText(
      await readPdfText(await buildConsentPdfV1(adult, winterSignature)),
    );

    if (!("ok" in result)) throw new Error(result.error);
    expect(withoutSignature(result.consent)).toEqual(
      withoutSignature({ ...adult, mediaForTraining: false }),
    );
    expect(result.signedAt).toEqual(winterSignature);
  });

  it("rejects a minor's consent without a guardian, the same as the web form would", async () => {
    const text = (await pdfText(minor, summerSignature)).replace(
      /Padre, madre o tutor: .*/,
      "Padre, madre o tutor: —",
    );

    expect(parseConsentText(text)).toHaveProperty("error");
  });

  it("rejects a document where privacy was not accepted, because it is not a valid consent", async () => {
    const text = (await pdfText(adult, summerSignature)).replace(
      "[X] Completamente",
      "[ ] Completamente",
    );

    expect(parseConsentText(text)).toHaveProperty("error");
  });

  it("rejects text that is not a consent instead of guessing", () => {
    expect(parseConsentText("Factura 2026/001\nTotal: 40 €")).toHaveProperty(
      "error",
    );
  });

  it("rejects a source that is not one of the form's options instead of inventing one", async () => {
    const text = (await pdfText(adult, summerSignature)).replace(
      "Cómo nos ha conocido: Familiares o amigos",
      "Cómo nos ha conocido: Periódico",
    );

    expect(parseConsentText(text)).toHaveProperty("error");
  });
});

function fakeAdmin({
  existing = [],
  match = [],
  insertError = null,
}: {
  existing?: { tax_id: string; signed_at: string }[];
  match?: { person_id: string; method: string }[];
  insertError?: { message: string } | null;
} = {}) {
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(async () => ({ error: insertError }));
  const rpc = vi.fn(async () => ({ data: match, error: null }));
  const lookups: Record<string, string>[] = [];
  const select = () => {
    const filters: Record<string, string> = {};
    const query = {
      eq: (column: string, value: string) => {
        filters[`eq:${column}`] = value;
        return query;
      },
      gte: (column: string, value: string) => {
        filters[`gte:${column}`] = value;
        return query;
      },
      lt: (column: string, value: string) => {
        filters[`lt:${column}`] = value;
        return query;
      },
      limit: async () => {
        lookups.push(filters);
        const data = existing.filter(
          (row) =>
            row.tax_id === filters["eq:tax_id"] &&
            row.signed_at >= (filters["gte:signed_at"] ?? "") &&
            row.signed_at < (filters["lt:signed_at"] ?? ""),
        );
        return { data, error: null };
      },
    };
    return query;
  };
  const admin = {
    storage: { from: () => ({ upload, remove }) },
    rpc,
    from: () => ({ select, insert }),
  } as unknown as AdminClient;
  return { admin, upload, insert, lookups };
}

describe("importConsents", () => {
  it("files each readable consent with its original PDF bytes and links it when the web would", async () => {
    const pdf = await buildConsentPdf(minor, summerSignature);
    const { admin, upload, insert } = fakeAdmin({
      match: [{ person_id: "p1", method: "auto_guardian" }],
    });

    const summary = await importConsents({ admin, pdfs: [pdf], dry: false });

    expect(upload).toHaveBeenCalledWith(expect.any(String), pdf, {
      contentType: "application/pdf",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_id: "12345678Z",
        signed_at: summerSignature.toISOString(),
        person_id: "p1",
      }),
    );
    expect(summary).toEqual({
      total: 1,
      imported: 1,
      linked: { auto_guardian: 1 },
      pending: 0,
      repeated: 0,
      unreadable: [],
      failed: [],
    });
  });

  it("leaves a consent pending when nobody is safe to link", async () => {
    const { admin } = fakeAdmin();

    const summary = await importConsents({
      admin,
      pdfs: [await buildConsentPdf(adult, summerSignature)],
      dry: false,
    });

    expect(summary).toMatchObject({ imported: 1, linked: {}, pending: 1 });
  });

  it("skips a consent already stored with the same DNI and signing minute, so running it twice imports nothing new", async () => {
    const { admin, upload, lookups } = fakeAdmin({
      existing: [
        { tax_id: "12345678Z", signed_at: "2026-09-22T10:30:41.123Z" },
      ],
    });

    const summary = await importConsents({
      admin,
      pdfs: [await buildConsentPdf(minor, summerSignature)],
      dry: false,
    });

    expect(upload).not.toHaveBeenCalled();
    expect(lookups[0]).toEqual({
      "eq:tax_id": "12345678Z",
      "gte:signed_at": "2026-09-22T10:30:00.000Z",
      "lt:signed_at": "2026-09-22T10:31:00.000Z",
    });
    expect(summary).toMatchObject({ imported: 0, repeated: 1 });
  });

  it("imports the same consent only once when the folder holds two copies of it", async () => {
    const pdf = await buildConsentPdf(minor, summerSignature);
    const { admin, upload } = fakeAdmin();

    const summary = await importConsents({
      admin,
      pdfs: [pdf, pdf.slice()],
      dry: false,
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ total: 2, imported: 1, repeated: 1 });
  });

  it("reports unreadable files only by their position, never by their content", async () => {
    const { admin } = fakeAdmin();

    const summary = await importConsents({
      admin,
      pdfs: [
        await buildConsentPdf(adult, summerSignature),
        new Uint8Array([1, 2, 3]),
      ],
      dry: false,
    });

    expect(summary).toMatchObject({ imported: 1, unreadable: [2] });
  });

  it("keeps going and reports the position when storing one consent fails", async () => {
    const { admin } = fakeAdmin({ insertError: { message: "db down" } });

    const summary = await importConsents({
      admin,
      pdfs: [await buildConsentPdf(adult, summerSignature)],
      dry: false,
    });

    expect(summary).toMatchObject({ imported: 0, failed: [1] });
  });

  it("in a dry run reports what would happen without uploading or inserting anything", async () => {
    const { admin, upload, insert } = fakeAdmin({
      match: [{ person_id: "p1", method: "auto_tax_id" }],
    });

    const summary = await importConsents({
      admin,
      pdfs: [
        await buildConsentPdf(minor, summerSignature),
        await buildConsentPdf(adult, winterSignature),
      ],
      dry: true,
    });

    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      total: 2,
      imported: 2,
      linked: { auto_tax_id: 2 },
      pending: 0,
    });
  });
});
