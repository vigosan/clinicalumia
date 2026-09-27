import { describe, expect, it, vi } from "vitest";
import { inviteOwner } from "./invite-owner";

function fakeSupabase({
  existingProfile = null,
  profileError = null,
}: {
  existingProfile?: { id: string } | null;
  profileError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn(async () => ({ data: existingProfile }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn(async () => ({ error: profileError }));
  const from = vi.fn(() => ({ select, insert }));
  const inviteUserByEmail = vi.fn(async () => ({
    data: { user: { id: "user-1" } },
    error: null,
  }));
  const deleteUser = vi.fn(async () => ({ error: null }));
  const supabase = {
    from,
    auth: { admin: { inviteUserByEmail, deleteUser } },
  } as unknown as Parameters<typeof inviteOwner>[0];
  return { supabase, select, insert, inviteUserByEmail, deleteUser };
}

const params = {
  email: "duena@lumia.test",
  fullName: "Dueña de Prueba",
  redirectTo: "https://panel.clinicalumia.es/auth/confirm",
};

describe("inviteOwner", () => {
  it("invites the owner and creates her profile with role owner", async () => {
    const { supabase, insert, inviteUserByEmail } = fakeSupabase();

    const result = await inviteOwner(supabase, params);

    expect(result).toEqual({ ok: true, created: true });
    expect(inviteUserByEmail).toHaveBeenCalledWith(params.email, {
      redirectTo: params.redirectTo,
    });
    expect(insert).toHaveBeenCalledWith({
      id: "user-1",
      email: params.email,
      full_name: params.fullName,
      role: "owner",
      is_active: true,
    });
  });

  it("does nothing when a profile with that email already exists", async () => {
    const { supabase, inviteUserByEmail } = fakeSupabase({
      existingProfile: { id: "existing-1" },
    });

    const result = await inviteOwner(supabase, params);

    expect(result).toEqual({
      ok: true,
      created: false,
      message: `Profile already exists for ${params.email}. Nothing to do.`,
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("deletes the invited user and reports the error when the profile fails", async () => {
    const { supabase, deleteUser } = fakeSupabase({
      profileError: { message: "boom" },
    });

    const result = await inviteOwner(supabase, params);

    expect(result).toEqual({ ok: false, error: "boom" });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });
});
