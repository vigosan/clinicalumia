import { describe, expect, it, vi } from "vitest";
import { resetOwnerMfa } from "./reset-owner-mfa";

function fakeSupabase({
  profile = { id: "owner-1", role: "owner" },
  profileError = null,
  factors = [{ id: "factor-1" }, { id: "factor-2" }],
  listError = null,
  deleteError = null,
  revokeError = null,
}: {
  profile?: { id: string; role: string } | null;
  profileError?: { message: string } | null;
  factors?: { id: string }[];
  listError?: { message: string } | null;
  deleteError?: { message: string } | null;
  revokeError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: profile,
    error: profileError,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const listFactors = vi.fn(async () => ({
    data: listError ? null : { factors },
    error: listError,
  }));
  const deleteFactor = vi.fn(async () => ({ data: null, error: deleteError }));
  const rpc = vi.fn(async () => ({ error: revokeError }));
  const supabase = {
    from,
    rpc,
    auth: { admin: { mfa: { listFactors, deleteFactor } } },
  } as unknown as Parameters<typeof resetOwnerMfa>[0];
  return { supabase, eq, listFactors, deleteFactor, rpc };
}

describe("resetOwnerMfa", () => {
  it("deletes every factor of the owner and closes her sessions, so she sets up the code again on her next sign-in", async () => {
    const { supabase, eq, deleteFactor, rpc } = fakeSupabase();

    const result = await resetOwnerMfa(supabase, " Info@ClinicaLumia.es ");

    expect(result).toEqual({ ok: true, removed: 2 });
    expect(eq).toHaveBeenCalledWith("email", "info@clinicalumia.es");
    expect(deleteFactor).toHaveBeenCalledWith({
      id: "factor-1",
      userId: "owner-1",
    });
    expect(deleteFactor).toHaveBeenCalledWith({
      id: "factor-2",
      userId: "owner-1",
    });
    expect(rpc).toHaveBeenCalledWith("revoke_user_sessions", {
      target: "owner-1",
    });
  });

  it("refuses an employee and touches nothing, because the owner already resets the team from Admin › Equipo", async () => {
    const { supabase, listFactors, deleteFactor, rpc } = fakeSupabase({
      profile: { id: "employee-1", role: "employee" },
    });

    const result = await resetOwnerMfa(supabase, "laura@lumia.test");

    expect(result).toEqual({
      ok: false,
      error:
        "laura@lumia.test no es la propietaria. Su verificación la restablece la propietaria desde Admin › Equipo.",
    });
    expect(listFactors).not.toHaveBeenCalled();
    expect(deleteFactor).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an email without a team profile and touches nothing", async () => {
    const { supabase, listFactors, rpc } = fakeSupabase({ profile: null });

    const result = await resetOwnerMfa(supabase, "nadie@lumia.test");

    expect(result).toEqual({
      ok: false,
      error: "No hay ninguna cuenta del equipo con el email nadie@lumia.test.",
    });
    expect(listFactors).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stops before deleting anything when the profile lookup fails", async () => {
    const { supabase, listFactors } = fakeSupabase({
      profileError: { message: "connection refused" },
    });

    expect(await resetOwnerMfa(supabase, "info@clinicalumia.es")).toEqual({
      ok: false,
      error: "connection refused",
    });
    expect(listFactors).not.toHaveBeenCalled();
  });

  it("stops and does not close sessions when a factor cannot be deleted, so the output never claims a reset that did not happen", async () => {
    const { supabase, rpc } = fakeSupabase({
      deleteError: { message: "boom" },
    });

    expect(await resetOwnerMfa(supabase, "info@clinicalumia.es")).toEqual({
      ok: false,
      error: "boom",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports when the factors are gone but her open sessions could not be closed", async () => {
    const { supabase } = fakeSupabase({
      revokeError: { message: "permission denied" },
    });

    expect(await resetOwnerMfa(supabase, "info@clinicalumia.es")).toEqual({
      ok: false,
      error:
        "Se han borrado los factores, pero no se han podido cerrar sus sesiones: permission denied",
    });
  });
});
