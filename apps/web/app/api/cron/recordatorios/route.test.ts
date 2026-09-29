import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendDailyReminders = vi.fn();
const admin = { tag: "admin" };

vi.mock("@/lib/reminders", () => ({ sendDailyReminders }));
vi.mock("@clinicalumia/api/admin", () => ({
  createAdminClient: () => admin,
}));

const { GET } = await import("./route");

function request(authorization?: string) {
  return new Request("http://localhost:3000/api/cron/recordatorios", {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  sendDailyReminders.mockReset();
  sendDailyReminders.mockResolvedValue({ sent: 2, failed: 1, skipped: 0 });
  vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/recordatorios", () => {
  it("rejects a call without the secret, so nobody on the internet can make the clinic email its patients", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(sendDailyReminders).not.toHaveBeenCalled();
  });

  it("rejects a call with the wrong secret", async () => {
    const response = await GET(request("Bearer otro-secreto"));

    expect(response.status).toBe(401);
    expect(sendDailyReminders).not.toHaveBeenCalled();
  });

  it("rejects every call when CRON_SECRET is not configured, so a missing secret never leaves the route open to 'Bearer undefined'", async () => {
    vi.stubEnv("CRON_SECRET", "");

    for (const authorization of [undefined, "Bearer ", "Bearer undefined"]) {
      const response = await GET(request(authorization));
      expect(response.status).toBe(401);
    }
    expect(sendDailyReminders).not.toHaveBeenCalled();
  });

  it("sends the reminders with the service client and reports the counts, so the scheduler's log shows what happened", async () => {
    const response = await GET(request("Bearer secreto-de-prueba"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(sendDailyReminders).toHaveBeenCalledWith({
      admin,
      now: expect.any(Date),
    });
  });
});
