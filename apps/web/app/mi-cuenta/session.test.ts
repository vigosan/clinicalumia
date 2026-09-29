import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { requirePatientPage } = await import("./session");

beforeEach(() => {
  getUser.mockReset();
});

describe("requirePatientPage", () => {
  it("sends someone without a session to /acceder remembering the page, so after entering they come back to the same appointment", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(
      requirePatientPage("/mi-cuenta/citas/abc/cancelar"),
    ).rejects.toThrow(
      "redirect:/acceder?next=%2Fmi-cuenta%2Fcitas%2Fabc%2Fcancelar",
    );
  });

  it("gives the page the signed-in user, whose email receives the account's messages", async () => {
    const user = { id: "u1", email: "marta@test.local" };
    getUser.mockResolvedValue({ data: { user } });

    expect(await requirePatientPage("/mi-cuenta")).toBe(user);
  });
});
