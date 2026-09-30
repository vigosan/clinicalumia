import type { createAdminClient } from "@clinicalumia/api/admin";
import { describe, expect, it, vi } from "vitest";
import type { Consent } from "./consent";
import { matchConsentPerson, storeConsent } from "./consent-store";

type AdminClient = ReturnType<typeof createAdminClient>;

const consent: Consent = {
  firstName: "Ana",
  lastName: "García López",
  guardian: "",
  birthDate: "1990-05-10",
  dni: "12345678Z",
  email: "Ana@Example.com",
  sources: ["Familiares o amigos"],
  marketing: false,
  mediaForTraining: false,
  signature: "data:image/png;base64,iVBORw0KGgo=",
};
const signedAt = new Date("2026-09-22T10:30:00Z");
const pdf = new Uint8Array([1, 2, 3]);

function fakeAdmin({
  match = [],
  uploadError = null,
  matchError = null,
  insertError = null,
}: {
  match?: { person_id: string; method: string }[];
  uploadError?: { message: string } | null;
  matchError?: { message: string } | null;
  insertError?: { message: string } | null;
} = {}) {
  const calls: string[] = [];
  const remove = vi.fn(async () => {
    calls.push("remove");
    return { error: null };
  });
  const upload = vi.fn(async () => {
    calls.push("upload");
    return { error: uploadError };
  });
  const rpc = vi.fn(async () => {
    calls.push("match");
    return { data: matchError ? null : match, error: matchError };
  });
  const insert = vi.fn(async () => {
    calls.push("insert");
    return { error: insertError };
  });
  const admin = {
    storage: {
      from: (bucket: string) => {
        calls.push(`storage:${bucket}`);
        return { upload, remove };
      },
    },
    rpc,
    from: (table: string) => {
      calls.push(`from:${table}`);
      return { insert };
    },
  } as unknown as AdminClient;
  return { admin, calls, upload, remove, rpc, insert };
}

describe("storeConsent", () => {
  it("uploads the PDF, looks for a match and only then inserts the row, so a row can never point at a file that is not there yet", async () => {
    const { admin, calls } = fakeAdmin();

    await storeConsent({ admin, consent, signedAt, pdf });

    expect(calls).toEqual([
      "storage:consents",
      "upload",
      "match",
      "from:consents",
      "insert",
    ]);
  });

  it("uploads to a path scoped by year, month and the consent's own id, and stores that same path", async () => {
    const { admin, upload, insert } = fakeAdmin();

    const result = await storeConsent({ admin, consent, signedAt, pdf });

    const path = `2026/09/${result.id}.pdf`;
    expect(upload).toHaveBeenCalledWith(path, pdf, {
      contentType: "application/pdf",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id, pdf_path: path }),
    );
  });

  it("links the consent to the person match_consent_person finds, lowercasing the stored email", async () => {
    const { admin, insert } = fakeAdmin({
      match: [{ person_id: "p1", method: "auto_tax_id" }],
    });

    const result = await storeConsent({ admin, consent, signedAt, pdf });

    expect(result).toMatchObject({ personId: "p1", method: "auto_tax_id" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: "p1",
        link_method: "auto_tax_id",
        linked_at: signedAt.toISOString(),
        email: "ana@example.com",
      }),
    );
  });

  it("leaves the consent unlinked when nobody matches", async () => {
    const { admin, insert } = fakeAdmin({ match: [] });

    const result = await storeConsent({ admin, consent, signedAt, pdf });

    expect(result).toMatchObject({ personId: null, method: null });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: null,
        link_method: null,
        linked_at: null,
      }),
    );
  });

  it("stores no email when the signer left it blank, instead of an empty string", async () => {
    const { admin, insert } = fakeAdmin();

    await storeConsent({
      admin,
      consent: { ...consent, email: "" },
      signedAt,
      pdf,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    );
  });

  it("deletes the uploaded PDF when the insert fails, so no orphaned file survives an unsaved consent", async () => {
    const { admin, remove } = fakeAdmin({
      insertError: { message: "db down" },
    });

    await expect(
      storeConsent({ admin, consent, signedAt, pdf }),
    ).rejects.toThrow("db down");

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("deletes the uploaded PDF when looking for the person fails, so no orphaned file survives an unsaved consent", async () => {
    const { admin, insert, remove } = fakeAdmin({
      matchError: { message: "rpc down" },
    });

    await expect(
      storeConsent({ admin, consent, signedAt, pdf }),
    ).rejects.toThrow("rpc down");

    expect(insert).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^2026\/09\/.+\.pdf$/),
    ]);
  });

  it("never inserts when the upload fails, so a consent row can never be created without its PDF", async () => {
    const { admin, insert, remove } = fakeAdmin({
      uploadError: { message: "storage down" },
    });

    await expect(
      storeConsent({ admin, consent, signedAt, pdf }),
    ).rejects.toThrow("storage down");

    expect(insert).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("matchConsentPerson", () => {
  it("asks the database with the consent's identifiers, so imports and the web link people by the same rules", async () => {
    const { admin, rpc } = fakeAdmin({
      match: [{ person_id: "p1", method: "auto_guardian" }],
    });

    const match = await matchConsentPerson(admin, consent);

    expect(match).toEqual({ person_id: "p1", method: "auto_guardian" });
    expect(rpc).toHaveBeenCalledWith("match_consent_person", {
      p_tax_id: "12345678Z",
      p_email: "Ana@Example.com",
      p_birth_date: "1990-05-10",
      p_first_name: "Ana",
    });
  });

  it("returns no match when nobody is safe to link, leaving the consent pending", async () => {
    const { admin } = fakeAdmin({ match: [] });

    expect(await matchConsentPerson(admin, consent)).toBeNull();
  });

  it("fails loudly when the lookup fails, instead of silently leaving the consent pending", async () => {
    const { admin } = fakeAdmin({ matchError: { message: "rpc down" } });

    await expect(matchConsentPerson(admin, consent)).rejects.toThrow(
      "rpc down",
    );
  });
});
