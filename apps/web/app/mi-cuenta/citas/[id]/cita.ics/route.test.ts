import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const rpc = vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>();
let user: { email: string } | null;

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));

const { GET } = await import("./route");

const APPOINTMENT = "77777777-7777-7777-7777-777777777777";

function appointmentRow(overrides: Record<string, string> = {}) {
  return {
    id: APPOINTMENT,
    starts_at: "2026-10-02T07:00:00+00:00",
    ends_at: "2026-10-02T07:45:00+00:00",
    service_name: "Sesión de logopedia",
    status: "scheduled",
    ...overrides,
  };
}

function request() {
  return new Request(
    `http://localhost:3000/mi-cuenta/citas/${APPOINTMENT}/cita.ics`,
  );
}

function context(id = APPOINTMENT) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  rpc.mockReset();
  user = { email: "marta@test.local" };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /mi-cuenta/citas/[id]/cita.ics", () => {
  it("refuses a visitor without a patient session", async () => {
    user = null;

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not exist when the appointment is not in this account", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
  });

  it("does not exist for a team session, since a team member has no appointments of their own", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "patient_account_required", code: "42501" },
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
  });

  it("does not exist for a cancelled appointment, so the patient never adds to their calendar a visit that will not happen", async () => {
    rpc.mockResolvedValue({
      data: [appointmentRow({ status: "cancelled" })],
      error: null,
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
  });

  it("does not exist for an appointment that already took place, since Mi cuenta only offers the calendar for upcoming ones", async () => {
    rpc.mockResolvedValue({
      data: [
        appointmentRow({
          starts_at: "2026-09-28T07:00:00+00:00",
          ends_at: "2026-09-28T07:45:00+00:00",
        }),
      ],
      error: null,
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
  });

  it("serves the appointment as a calendar file with its real time, never cached, since it is private and can change", async () => {
    rpc.mockResolvedValue({ data: [appointmentRow()], error: null });

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="cita.ics"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.text();
    expect(body).toContain(`UID:${APPOINTMENT}@clinicalumia.es`);
    expect(body).toContain("DTSTART:20261002T070000Z");
    expect(body).toContain("DTEND:20261002T074500Z");
  });
});
