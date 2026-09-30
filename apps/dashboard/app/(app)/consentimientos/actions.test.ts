import { beforeEach, describe, expect, it, vi } from "vitest";

const CONSENT_ID = "a1000000-0000-0000-0000-000000000001";
const PERSON_ID = "b2000000-0000-0000-0000-000000000002";

const rpcResult: {
  error: { code?: string; message?: string } | null;
} = { error: null };
const rpc = vi.fn(async () => rpcResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ rpc }),
}));

const { revalidatePath } = await import("next/cache");
const { linkConsent, unlinkConsent } = await import("./actions");
const { consentLinkErrorCode, CONSENT_LINK_ERROR_MESSAGES } = await import(
  "@/lib/consent-link-error"
);

beforeEach(() => {
  rpcResult.error = null;
  rpc.mockClear();
  vi.mocked(revalidatePath).mockClear();
});

describe("linkConsent", () => {
  it("links through link_consent so the database records who linked it, and refreshes the list and the detail", async () => {
    const result = await linkConsent(CONSENT_ID, PERSON_ID);
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("link_consent", {
      p_consent_id: CONSENT_ID,
      p_person_id: PERSON_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos");
    expect(revalidatePath).toHaveBeenCalledWith(
      `/consentimientos/${CONSENT_ID}`,
    );
  });

  it("explains that the chosen record is gone instead of a generic failure", async () => {
    rpcResult.error = { code: "P0001", message: "person_not_found" };
    expect(await linkConsent(CONSENT_ID, PERSON_ID)).toEqual({
      error: "Esa ficha ya no existe o está archivada.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains that the consent is gone", async () => {
    rpcResult.error = { code: "P0001", message: "consent_not_found" };
    expect(await linkConsent(CONSENT_ID, PERSON_ID)).toEqual({
      error: "Ese consentimiento ya no existe.",
    });
  });

  it("tells staff someone else already linked it and refreshes so they see to whom", async () => {
    rpcResult.error = { code: "P0001", message: "consent_already_linked" };
    expect(await linkConsent(CONSENT_ID, PERSON_ID)).toEqual({
      error: "Este consentimiento ya está asociado.",
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      `/consentimientos/${CONSENT_ID}`,
    );
  });

  it("says staff lack permission when the database refuses them", async () => {
    rpcResult.error = { code: "42501", message: "consent_forbidden" };
    expect(await linkConsent(CONSENT_ID, PERSON_ID)).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });

  it("falls back to a generic message for anything unexpected", async () => {
    rpcResult.error = { code: "XX000", message: "boom" };
    expect(await linkConsent(CONSENT_ID, PERSON_ID)).toEqual({
      error: "No se ha podido guardar.",
    });
  });

  it("returns only messages from the shared map, so creating a record from a consent can redirect with the matching code", async () => {
    const cases = [
      [{ code: "42501", message: "consent_forbidden" }, "permission"],
      [{ code: "P0001", message: "person_not_found" }, "person-not-found"],
      [{ code: "P0001", message: "consent_not_found" }, "consent-not-found"],
      [{ code: "P0001", message: "consent_already_linked" }, "already-linked"],
      [{ code: "XX000", message: "boom" }, "unknown"],
    ] as const;
    for (const [error, code] of cases) {
      rpcResult.error = error;
      const result = await linkConsent(CONSENT_ID, PERSON_ID);
      expect(result).toEqual({ error: CONSENT_LINK_ERROR_MESSAGES[code] });
      expect(consentLinkErrorCode((result as { error: string }).error)).toBe(
        code,
      );
    }
  });

  it("rejects ids that are not uuids without asking the database", async () => {
    expect(await linkConsent("not-a-uuid", PERSON_ID)).toEqual({
      error: "No se ha podido guardar.",
    });
    expect(await linkConsent(CONSENT_ID, "not-a-uuid")).toEqual({
      error: "No se ha podido guardar.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("unlinkConsent", () => {
  it("unlinks through unlink_consent and refreshes the list and the detail", async () => {
    expect(await unlinkConsent(CONSENT_ID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("unlink_consent", {
      p_consent_id: CONSENT_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos");
    expect(revalidatePath).toHaveBeenCalledWith(
      `/consentimientos/${CONSENT_ID}`,
    );
  });

  it("explains that the consent is gone", async () => {
    rpcResult.error = { code: "P0001", message: "consent_not_found" };
    expect(await unlinkConsent(CONSENT_ID)).toEqual({
      error: "Ese consentimiento ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says staff lack permission when the database refuses them", async () => {
    rpcResult.error = { code: "42501", message: "consent_forbidden" };
    expect(await unlinkConsent(CONSENT_ID)).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });

  it("rejects an id that is not a uuid without asking the database", async () => {
    expect(await unlinkConsent("not-a-uuid")).toEqual({
      error: "No se ha podido guardar.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
