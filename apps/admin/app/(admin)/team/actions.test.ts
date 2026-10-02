import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const result = { error: null as null | { code: string; message: string } };
const updateEq = vi.fn(async () => result);
const updateFn = vi.fn(() => ({ eq: updateEq }));
const rpcResult = { error: null as null | { code: string; message: string } };
const pendingResult = {
  data: [{ profile_id: "invited-1" }] as { profile_id: string }[] | null,
  error: null as null | { code: string; message: string },
};
const rpcFn = vi.fn(async (name: string) =>
  name === "pending_invitations" ? pendingResult : rpcResult,
);
const profileResult = {
  data: { email: "nueva@lumia.test" } as { email: string } | null,
  error: null as null | { code: string; message: string },
};
const profileEq = vi.fn(() => ({ single: async () => profileResult }));

type UpcomingRow = {
  id: string;
  starts_at: string;
  patient: { first_name: string; last_name: string } | null;
  professional: { full_name: string } | null;
};
const upcomingResult = {
  data: [] as UpcomingRow[] | null,
  error: null as null | { code: string; message: string },
};
const upcomingCalls: unknown[][] = [];
const upcomingQuery = {
  select: (...args: unknown[]) => {
    upcomingCalls.push(["select", ...args]);
    return upcomingQuery;
  },
  eq: (...args: unknown[]) => {
    upcomingCalls.push(["eq", ...args]);
    return upcomingQuery;
  },
  neq: (...args: unknown[]) => {
    upcomingCalls.push(["neq", ...args]);
    return upcomingQuery;
  },
  gt: (...args: unknown[]) => {
    upcomingCalls.push(["gt", args[0]]);
    return upcomingQuery;
  },
  order: async (...args: unknown[]) => {
    upcomingCalls.push(["order", ...args]);
    return upcomingResult;
  },
};

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@clinicalumia/api/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === "appointments"
        ? upcomingQuery
        : { update: updateFn, select: () => ({ eq: profileEq }) },
    rpc: rpcFn,
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
  revokeCalendarLink,
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
    rpcResult.error = null;
    rpcFn.mockClear();
    pendingResult.data = [{ profile_id: "invited-1" }];
    pendingResult.error = null;
    profileResult.data = { email: "nueva@lumia.test" };
    profileResult.error = null;
    profileEq.mockClear();
    vi.mocked(createAdminClient).mockClear();
    revalidatePathMock.mockClear();
    upcomingResult.data = [];
    upcomingResult.error = null;
    upcomingCalls.length = 0;
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

  it("tells the owner the email belongs to a patient account instead of promoting that patient to staff", async () => {
    const insertFn = vi.fn();
    const maybeSingle = vi.fn(async () => ({
      data: { id: "patient-1" },
      error: null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const from = vi.fn((table: string) =>
      table === "patient_accounts"
        ? { select: () => ({ eq }) }
        : { insert: insertFn },
    );
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: null },
            error: {
              message:
                "A user with this email address has already been registered",
            },
          })),
        },
      },
      from,
    } as unknown as ReturnType<typeof createAdminClient>);
    const data = new FormData();
    data.set("email", " Paciente@Lumia.test ");
    data.set("full_name", "Paciente Persona");
    expect(await createMember(undefined, data)).toEqual({
      error:
        "Ese email ya tiene una cuenta de paciente. Usa otro email para el equipo.",
    });
    expect(eq).toHaveBeenCalledWith("email", "paciente@lumia.test");
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("keeps the generic duplicate message when the existing account is not a patient", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: null },
            error: {
              message:
                "A user with this email address has already been registered",
            },
          })),
        },
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as unknown as ReturnType<typeof createAdminClient>);
    const data = new FormData();
    data.set("email", "equipo@lumia.test");
    data.set("full_name", "Equipo Persona");
    expect(await createMember(undefined, data)).toEqual({
      error: "Ya hay una cuenta con ese email.",
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
    expect(await resendInvite("invited-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("resends the invitation to the member's own email, read on the server instead of trusting the browser", async () => {
    const inviteUserByEmail = vi.fn(async () => ({ data: {}, error: null }));
    const resetPasswordForEmail = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { inviteUserByEmail }, resetPasswordForEmail },
    } as unknown as ReturnType<typeof createAdminClient>);
    expect(await resendInvite("invited-1")).toEqual({ ok: true });
    expect(profileEq).toHaveBeenCalledWith("id", "invited-1");
    expect(inviteUserByEmail).toHaveBeenCalledWith("nueva@lumia.test");
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("refuses a member who already accepted, so nobody active gets a set-password email from a forged call", async () => {
    pendingResult.data = [];
    expect(await resendInvite("invited-1")).toEqual({
      error: "Ya ha aceptado la invitación.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not resend when it cannot check whether the invitation is pending", async () => {
    pendingResult.data = null;
    pendingResult.error = { code: "500", message: "boom" };
    expect(await resendInvite("invited-1")).toEqual({
      error: "No se ha podido reenviar la invitación.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("sends a set-password link instead when she opened the invitation but never chose a password, since Supabase refuses to invite an existing account again", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({
      data: {},
      error: null,
    }));
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: null },
            error: {
              code: "email_exists",
              message:
                "A user with this email address has already been registered",
            },
          })),
        },
        resetPasswordForEmail,
      },
    } as unknown as ReturnType<typeof createAdminClient>);
    expect(await resendInvite("invited-1")).toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("nueva@lumia.test");
  });

  it("does not send a set-password link when the invitation fails for any other reason", async () => {
    const resetPasswordForEmail = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: null },
            error: { code: "over_email_send_rate_limit", message: "rate" },
          })),
        },
        resetPasswordForEmail,
      },
    } as unknown as ReturnType<typeof createAdminClient>);
    expect(await resendInvite("invited-1")).toEqual({
      error: "No se ha podido reenviar la invitación.",
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("reports a Spanish error when the set-password link cannot be sent either", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({
            data: { user: null },
            error: { code: "email_exists", message: "already been registered" },
          })),
        },
        resetPasswordForEmail: vi.fn(async () => ({
          data: null,
          error: { message: "boom" },
        })),
      },
    } as unknown as ReturnType<typeof createAdminClient>);
    expect(await resendInvite("invited-1")).toEqual({
      error: "No se ha podido reenviar la invitación.",
    });
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

  it("looks for the member's upcoming non-cancelled appointments before deactivating her", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({ error: null })),
    } as unknown as ReturnType<typeof createAdminClient>);

    await setMemberActive("employee-1", false);

    expect(upcomingCalls).toEqual([
      [
        "select",
        "id, starts_at, patient:people(first_name, last_name), professional:profiles!appointments_professional_id_fkey(full_name)",
      ],
      ["eq", "professional_id", "employee-1"],
      ["neq", "status", "cancelled"],
      ["gt", "starts_at"],
      ["order", "starts_at", { ascending: true }],
    ]);
  });

  it("refuses to deactivate a member who still has upcoming appointments and lists them, so none is left without a professional", async () => {
    upcomingResult.data = [
      {
        id: "appointment-1",
        starts_at: "2026-12-24T09:30:00+00:00",
        patient: { first_name: "Ana", last_name: "Pérez" },
        professional: { full_name: "Laura Ejemplo" },
      },
    ];

    expect(await setMemberActive("employee-1", false)).toEqual({
      error:
        "Tiene citas pendientes. Muévelas a otra profesional o cancélalas desde el panel y vuelve a intentarlo.",
      appointments: [
        {
          id: "appointment-1",
          date: "24/12/2026",
          time: "10:30",
          patient: "Ana Pérez",
          professional: "Laura Ejemplo",
        },
      ],
    });
    expect(updateEq).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not deactivate when it cannot check the member's appointments", async () => {
    upcomingResult.data = null;
    upcomingResult.error = { code: "XX000", message: "boom" };

    expect(await setMemberActive("employee-1", false)).toEqual({
      error: "No se han podido comprobar sus citas pendientes.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("explains the block when an appointment is given between the check and the deactivation and the database refuses it", async () => {
    result.error = {
      code: "23514",
      message: "professional_has_upcoming_appointments",
    };

    expect(await setMemberActive("employee-1", false)).toEqual({
      error:
        "Tiene citas pendientes. Muévelas a otra profesional o cancélalas desde el panel y vuelve a intentarlo.",
    });
  });

  it("does not look for appointments when reactivating a member", async () => {
    expect(await setMemberActive("employee-1", true)).toEqual({ ok: true });
    expect(upcomingCalls).toEqual([]);
  });

  it("does not try to close sessions when reactivating a member", async () => {
    expect(await setMemberActive("employee-1", true)).toEqual({ ok: true });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses revokeCalendarLink for a non-owner and never calls the database", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await revokeCalendarLink("employee-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it("revokes the member's calendar token", async () => {
    expect(await revokeCalendarLink("employee-1")).toEqual({ ok: true });
    expect(rpcFn).toHaveBeenCalledWith("revoke_calendar_token", {
      p_profile_id: "employee-1",
    });
  });

  it("reports a generic error when the token revocation fails", async () => {
    rpcResult.error = { code: "500", message: "boom" };
    expect(await revokeCalendarLink("employee-1")).toEqual({
      error: "No se ha podido cortar el acceso al calendario del móvil.",
    });
  });
});
