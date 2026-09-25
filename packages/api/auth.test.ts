import { describe, expect, it } from "vitest";
import { requireOwner } from "./auth";

function fakeClient(
  user: { id: string } | null,
  profile: { role: string; is_active: boolean } | null,
) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile }) }),
      }),
    }),
  } as unknown as Parameters<typeof requireOwner>[0];
}

describe("requireOwner", () => {
  it("lets the active owner through", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u1" }, { role: "owner", is_active: true }),
    );
    expect(result).toEqual({ ok: true, userId: "u1" });
  });

  it("rejects an employee who calls an admin action directly, before any service-role key is used", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u2" }, { role: "employee", is_active: true }),
    );
    expect(result).toEqual({
      ok: false,
      error: "No tienes permiso para hacer esto.",
    });
  });

  it("rejects a deactivated owner", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u1" }, { role: "owner", is_active: false }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a request without a session", async () => {
    const result = await requireOwner(fakeClient(null, null));
    expect(result.ok).toBe(false);
  });
});
