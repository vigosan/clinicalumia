import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const result = { error: null as null | { code: string; message: string } };
const updateEq = vi.fn(async () => result);
const updateFn = vi.fn(() => ({ eq: updateEq }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@clinicalumia/api/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: updateFn,
    }),
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { createAdminClient } = await import("@clinicalumia/api/admin");
const {
  createMember,
  resendInvite,
  resetTwoFactor,
  setMemberActive,
  updateMember,
} = await import("./actions");

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
    updateFn.mockClear();
    vi.mocked(createAdminClient).mockClear();
    revalidatePathMock.mockClear();
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

  it("saves a trimmed license number when the form brings one", async () => {
    const data = nameForm("Laura Ejemplo");
    data.set("license_number", "  46-12345  ");
    expect(await updateMember("id", data)).toEqual({ ok: true });
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ license_number: "46-12345" }),
    );
  });

  it("saves a null license number when the form leaves it empty", async () => {
    expect(await updateMember("id", nameForm("Laura Ejemplo"))).toEqual({
      ok: true,
    });
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ license_number: null }),
    );
  });

  it("reports a database error when changing another member's status", async () => {
    result.error = { code: "500", message: "boom" };
    expect(await setMemberActive("other-id", false)).toEqual({
      error: "No se ha podido cambiar el estado.",
    });
  });

  it("saves a null license number when the createMember form leaves it empty", async () => {
    const insertFn = vi.fn(async () => ({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: { id: "new-user-1" } },
            error: null,
          })),
          deleteUser: vi.fn(),
        },
      },
      from: () => ({ insert: insertFn }),
    } as unknown as ReturnType<typeof createAdminClient>);
    const data = new FormData();
    data.set("email", "nueva@lumia.test");
    data.set("full_name", "Nueva Persona");
    expect(await createMember(undefined, data)).toEqual({ ok: true });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ license_number: null }),
    );
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

  it("refuses resetTwoFactor for a non-owner and never touches the admin client", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await resetTwoFactor("employee-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses to let the owner reset her own two-factor verification", async () => {
    expect(await resetTwoFactor(owner.userId)).toEqual({
      error: "No puedes restablecer tu propia verificación desde aquí.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a Spanish generic error when listing factors fails, never GoTrue's raw English message", async () => {
    const listFactors = vi.fn(async () => ({
      data: null,
      error: { message: "Unable to connect to the authentication server." },
    }));
    const deleteFactor = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { mfa: { listFactors, deleteFactor } } },
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await resetTwoFactor("employee-1")).toEqual({
      error: "No se ha podido restablecer la verificación.",
    });
    expect(deleteFactor).not.toHaveBeenCalled();
  });

  it("returns a generic error when deleting a factor fails", async () => {
    const listFactors = vi.fn(async () => ({
      data: { factors: [{ id: "factor-1" }, { id: "factor-2" }] },
      error: null,
    }));
    const deleteFactor = vi.fn(async ({ id }: { id: string }) =>
      id === "factor-1"
        ? { data: { id }, error: null }
        : { data: null, error: { message: "boom" } },
    );
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { mfa: { listFactors, deleteFactor } } },
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await resetTwoFactor("employee-1")).toEqual({
      error: "No se ha podido restablecer la verificación.",
    });
  });

  it("deletes every factor belonging to the employee", async () => {
    const listFactors = vi.fn(async () => ({
      data: { factors: [{ id: "factor-1" }, { id: "factor-2" }] },
      error: null,
    }));
    const deleteFactor = vi.fn(async () => ({
      data: { id: "factor-1" },
      error: null,
    }));
    const rpc = vi.fn(async () => ({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { mfa: { listFactors, deleteFactor } } },
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await resetTwoFactor("employee-1")).toEqual({ ok: true });
    expect(listFactors).toHaveBeenCalledWith({ userId: "employee-1" });
    expect(deleteFactor).toHaveBeenCalledWith({
      id: "factor-1",
      userId: "employee-1",
    });
    expect(deleteFactor).toHaveBeenCalledWith({
      id: "factor-2",
      userId: "employee-1",
    });
    expect(deleteFactor).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("revoke_user_sessions", {
      target: "employee-1",
    });
  });

  it("reports a specific error when it can't close the employee's sessions after resetting their two-factor", async () => {
    const listFactors = vi.fn(async () => ({
      data: { factors: [{ id: "factor-1" }] },
      error: null,
    }));
    const deleteFactor = vi.fn(async () => ({
      data: { id: "factor-1" },
      error: null,
    }));
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { mfa: { listFactors, deleteFactor } } },
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await resetTwoFactor("employee-1")).toEqual({
      error: "No se ha podido cerrar sus sesiones abiertas.",
    });
  });

  it("closes the employee's sessions after deactivating them", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await setMemberActive("employee-1", false)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("revoke_user_sessions", {
      target: "employee-1",
    });
  });

  it("reports a specific error when it can't close the employee's sessions after deactivating them, but still revalidates so the row doesn't show stale as active", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await setMemberActive("employee-1", false)).toEqual({
      error: "No se ha podido cerrar sus sesiones abiertas.",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/team");
  });

  it("does not try to close sessions when reactivating a member", async () => {
    expect(await setMemberActive("employee-1", true)).toEqual({ ok: true });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
