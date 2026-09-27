import { beforeEach, describe, expect, it, vi } from "vitest";

let updateError: { message: string } | null = null;
let mfaStep: "enroll" | "challenge" | "done" = "done";
const redirectMock = vi.fn();
const updateUserMock = vi.fn(async () => ({ error: updateError }));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    auth: {
      updateUser: updateUserMock,
    },
  }),
}));
vi.mock("@clinicalumia/api/mfa", () => ({
  getMfaStep: async () => mfaStep,
}));

const { setPassword } = await import("./actions");

function passwordForm(password: string, confirmation: string) {
  const data = new FormData();
  data.set("password", password);
  data.set("confirmation", confirmation);
  return data;
}

describe("setPassword action", () => {
  beforeEach(() => {
    updateError = null;
    mfaStep = "done";
    redirectMock.mockClear();
    updateUserMock.mockClear();
  });

  it("sends a session without a factor straight to enrolling", async () => {
    mfaStep = "enroll";
    await setPassword(
      undefined,
      passwordForm("lumia-segura-2026", "lumia-segura-2026"),
    );
    expect(redirectMock).toHaveBeenCalledWith("/auth/dos-pasos/activar");
  });

  it("refuses to change the password before the second factor is verified, so a recovery link alone can't take over a factored account", async () => {
    mfaStep = "challenge";
    const result = await setPassword(
      undefined,
      passwordForm("lumia-segura-2026", "lumia-segura-2026"),
    );
    expect(result).toEqual({
      error:
        "Termina la verificación en dos pasos antes de cambiar la contraseña.",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sends a session that already passed the second factor straight home", async () => {
    mfaStep = "done";
    await setPassword(
      undefined,
      passwordForm("lumia-segura-2026", "lumia-segura-2026"),
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("reports the update error without redirecting anywhere", async () => {
    updateError = { message: "invalid" };
    const result = await setPassword(
      undefined,
      passwordForm("lumia-segura-2026", "lumia-segura-2026"),
    );
    expect(result).toEqual({
      error: "No se ha podido guardar la contraseña. Pide un enlace nuevo.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
