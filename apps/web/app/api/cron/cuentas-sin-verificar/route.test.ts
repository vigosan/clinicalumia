import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteUnverifiedAccounts = vi.fn();
const admin = { tag: "admin" };

vi.mock("@/lib/unverified-accounts", () => ({ deleteUnverifiedAccounts }));
vi.mock("@clinicalumia/api/admin", () => ({
  createAdminClient: () => admin,
}));

const { GET } = await import("./route");
const vercel = (await import("@/vercel.json")).default;

function request(authorization?: string) {
  return new Request("http://localhost:3000/api/cron/cuentas-sin-verificar", {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  deleteUnverifiedAccounts.mockReset();
  deleteUnverifiedAccounts.mockResolvedValue({ deleted: 3, failed: 0 });
  vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/cuentas-sin-verificar", () => {
  it("rejects a call without the secret, so nobody on the internet can delete accounts", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(deleteUnverifiedAccounts).not.toHaveBeenCalled();
  });

  it("rejects a call with the wrong secret", async () => {
    const response = await GET(request("Bearer otro-secreto"));

    expect(response.status).toBe(401);
    expect(deleteUnverifiedAccounts).not.toHaveBeenCalled();
  });

  it("rejects every call when CRON_SECRET is not configured, so a missing secret never leaves the route open to 'Bearer undefined'", async () => {
    vi.stubEnv("CRON_SECRET", "");

    for (const authorization of [undefined, "Bearer ", "Bearer undefined"]) {
      const response = await GET(request(authorization));
      expect(response.status).toBe(401);
    }
    expect(deleteUnverifiedAccounts).not.toHaveBeenCalled();
  });

  it("cleans up with the service client and reports the counts, so the scheduler's log shows what happened", async () => {
    const response = await GET(request("Bearer secreto-de-prueba"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 3, failed: 0 });
    expect(deleteUnverifiedAccounts).toHaveBeenCalledWith({
      admin,
      now: expect.any(Date),
    });
  });

  it("answers with an error when the run refused to delete too many accounts, so the failed cron shows up in Vercel", async () => {
    deleteUnverifiedAccounts.mockResolvedValue({ tooMany: 250 });

    const response = await GET(request("Bearer secreto-de-prueba"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ tooMany: 250 });
  });

  it("runs once a day at night, within what Vercel's Hobby plan allows", () => {
    const runs = vercel.crons.filter(
      (cron) => cron.path === "/api/cron/cuentas-sin-verificar",
    );

    expect(runs.map((cron) => cron.schedule)).toEqual(["0 3 * * *"]);
  });
});
