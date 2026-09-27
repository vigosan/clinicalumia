import { beforeEach, describe, expect, it, vi } from "vitest";

let signInError: { message: string } | null = null;
let mfaStep: "enroll" | "challenge" | "done" = "done";
const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: signInError }),
    },
  }),
}));
vi.mock("@clinicalumia/api/mfa", () => ({
  getMfaStep: async () => mfaStep,
}));

const { login } = await import("./actions");

function loginForm(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

describe("login action", () => {
  beforeEach(() => {
    signInError = null;
    mfaStep = "done";
    redirectMock.mockClear();
  });

  it("sends a session without a factor straight to enrolling", async () => {
    mfaStep = "enroll";
    await login(undefined, loginForm("a@b.com", "lumia-desarrollo-2026"));
    expect(redirectMock).toHaveBeenCalledWith("/auth/dos-pasos/activar");
  });

  it("sends a session with a verified factor straight to the challenge", async () => {
    mfaStep = "challenge";
    await login(undefined, loginForm("a@b.com", "lumia-desarrollo-2026"));
    expect(redirectMock).toHaveBeenCalledWith("/auth/dos-pasos");
  });

  it("sends a session that already passed the second factor straight home", async () => {
    mfaStep = "done";
    await login(undefined, loginForm("a@b.com", "lumia-desarrollo-2026"));
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("reports wrong credentials without redirecting anywhere", async () => {
    signInError = { message: "invalid" };
    const result = await login(
      undefined,
      loginForm("a@b.com", "lumia-desarrollo-2026"),
    );
    expect(result).toEqual({ error: "Credenciales incorrectas." });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
