import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const result = { error: null as null | { code: string; message: string } };
const updateEq = vi.fn(async () => result);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: () => ({ eq: updateEq }),
    }),
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { createAdminClient } = await import("@clinicalumia/api/admin");
const { createMember, resendInvite, setMemberActive, updateMember } =
  await import("./actions");

function nameForm(name: string) {
  const data = new FormData();
  data.set("full_name", name);
  return data;
}

describe("team actions", () => {
  beforeEach(() => {
    ownerResult = owner;
    result.error = null;
    updateEq.mockClear();
    vi.mocked(createAdminClient).mockClear();
  });

  it("refuses updateMember for a non-owner and skips the update", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await updateMember("id", nameForm("Nueva"))).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("refuses to let the owner deactivate her own account", async () => {
    expect(await setMemberActive(owner.userId, false)).toEqual({
      error: "No puedes desactivar tu propia cuenta.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("reports a database error when changing another member's status", async () => {
    result.error = { code: "500", message: "boom" };
    expect(await setMemberActive("other-id", false)).toEqual({
      error: "No se ha podido cambiar el estado.",
    });
  });

  it("refuses createMember for a non-owner and never touches the admin client", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    const data = new FormData();
    data.set("email", "nuevo@lumia.test");
    data.set("full_name", "Nueva Persona");
    expect(await createMember(undefined, data)).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses resendInvite for a non-owner and never touches the admin client", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await resendInvite("nuevo@lumia.test")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
