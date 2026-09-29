import { describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async (_options?: { scope: string }) => ({
  error: null,
}));
const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

const { signOutOfAccount } = await import("./actions");

describe("signOutOfAccount", () => {
  it("closes the session before leaving for the home page, so a shared device does not stay inside the account", async () => {
    await signOutOfAccount();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
      redirectMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("only closes this device, so leaving on a shared computer does not sign the patient out of their phone", async () => {
    signOut.mockClear();

    await signOutOfAccount();

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
