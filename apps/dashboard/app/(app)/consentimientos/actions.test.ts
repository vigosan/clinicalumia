import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  rpcResult.error = null;
  rpc.mockClear();
  vi.mocked(revalidatePath).mockClear();
});

describe("linkConsent", () => {
  it("links through link_consent so the database records who linked it, and refreshes the list and the detail", async () => {
    const result = await linkConsent("consent-1", "person-1");
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("link_consent", {
      p_consent_id: "consent-1",
      p_person_id: "person-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos");
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos/consent-1");
  });

  it("explains that the chosen record is gone instead of a generic failure", async () => {
    rpcResult.error = { code: "P0001", message: "person_not_found" };
    expect(await linkConsent("consent-1", "person-1")).toEqual({
      error: "Esa ficha ya no existe o está archivada.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains that the consent is gone", async () => {
    rpcResult.error = { code: "P0001", message: "consent_not_found" };
    expect(await linkConsent("consent-1", "person-1")).toEqual({
      error: "Ese consentimiento ya no existe.",
    });
  });

  it("tells staff someone else already linked it and refreshes so they see to whom", async () => {
    rpcResult.error = { code: "P0001", message: "consent_already_linked" };
    expect(await linkConsent("consent-1", "person-1")).toEqual({
      error: "Este consentimiento ya está asociado.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos/consent-1");
  });

  it("says staff lack permission when the database refuses them", async () => {
    rpcResult.error = { code: "42501", message: "consent_forbidden" };
    expect(await linkConsent("consent-1", "person-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });

  it("falls back to a generic message for anything unexpected", async () => {
    rpcResult.error = { code: "XX000", message: "boom" };
    expect(await linkConsent("consent-1", "person-1")).toEqual({
      error: "No se ha podido guardar.",
    });
  });
});

describe("unlinkConsent", () => {
  it("unlinks through unlink_consent and refreshes the list and the detail", async () => {
    expect(await unlinkConsent("consent-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("unlink_consent", {
      p_consent_id: "consent-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos");
    expect(revalidatePath).toHaveBeenCalledWith("/consentimientos/consent-1");
  });

  it("explains that the consent is gone", async () => {
    rpcResult.error = { code: "P0001", message: "consent_not_found" };
    expect(await unlinkConsent("consent-1")).toEqual({
      error: "Ese consentimiento ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says staff lack permission when the database refuses them", async () => {
    rpcResult.error = { code: "42501", message: "consent_forbidden" };
    expect(await unlinkConsent("consent-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });
});
