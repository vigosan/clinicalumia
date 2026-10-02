import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = { id: "owner-1", role: "owner", specialty_id: null };
const EMPLOYEE = { id: "prof-1", role: "employee", specialty_id: "spec-1" };

let ownProfile: typeof OWNER | typeof EMPLOYEE = OWNER;
const rpcResults: Record<string, { data: unknown; error: unknown }> = {};
const rpc = vi.fn(async (name: string) => rpcResults[name]);

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ownProfile.id } } }),
    },
    rpc,
    from: (table: string) => {
      if (table === "profiles")
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: ownProfile, error: null }),
            }),
          }),
        };
      if (table === "services")
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [], error: null }) }),
          }),
        };
      return {};
    },
  }),
}));

vi.mock("@/lib/closures", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/closures")>()),
  loadClosures: async () => [],
}));

vi.mock("./actions", () => ({ canNotifyPatient: async () => false }));

const { loadAppointmentForm } = await import("./load-form");

const ACCEPTED_ID = "a0000000-0000-0000-0000-000000000001";
const PENDING_ID = "a0000000-0000-0000-0000-000000000002";

beforeEach(() => {
  ownProfile = OWNER;
  rpc.mockClear();
  rpcResults.staff_directory = {
    data: [
      {
        id: ACCEPTED_ID,
        full_name: "Marc Ejemplo",
        role: "employee",
        specialty_id: "spec-1",
      },
      {
        id: PENDING_ID,
        full_name: "Laura Invitada",
        role: "employee",
        specialty_id: "spec-1",
      },
    ],
    error: null,
  };
  rpcResults.pending_invitations = {
    data: [{ profile_id: PENDING_ID }],
    error: null,
  };
});

describe("loadAppointmentForm", () => {
  it("does not offer the owner a professional who has not accepted the invitation yet, since they cannot sign in to see the appointment", async () => {
    const result = await loadAppointmentForm({});

    expect(result).toMatchObject({ ok: true });
    const ids = result?.ok ? result.form.professionals.map((p) => p.id) : [];
    expect(ids).toEqual([ACCEPTED_ID]);
  });

  it("does not preselect a pending professional even when the link asks for them", async () => {
    const result = await loadAppointmentForm({ professional: PENDING_ID });

    expect(result?.ok && result.form.initialProfessionalId).toBe(null);
  });

  it("fails rather than offering pending professionals when the pending list cannot be read", async () => {
    rpcResults.pending_invitations = { data: null, error: { message: "x" } };

    expect(await loadAppointmentForm({})).toEqual({ ok: false });
  });

  it("does not ask for pending invitations as an employee, who books only for themselves and may not read that list", async () => {
    ownProfile = EMPLOYEE;

    const result = await loadAppointmentForm({});

    expect(result).toMatchObject({ ok: true });
    expect(rpc).not.toHaveBeenCalledWith("pending_invitations");
  });
});
