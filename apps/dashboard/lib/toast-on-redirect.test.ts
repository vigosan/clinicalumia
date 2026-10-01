import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@clinicalumia/ui/toast", () => ({ toast }));

import { toastOnRedirect } from "./toast-on-redirect";

type State = { error: string } | undefined;

function redirectError(location: string) {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;push;${location};307;`,
  });
}

describe("toastOnRedirect", () => {
  beforeEach(() => toast.mockClear());

  it("confirms the save when the server action redirects, which is how a saved form finishes", async () => {
    const action = toastOnRedirect<State>(async () => {
      throw redirectError("/?date=2026-10-05&appointment=a1");
    }, "Cita creada");

    await expect(action(undefined, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(toast).toHaveBeenCalledWith("Cita creada");
  });

  it("lets the message depend on where the redirect goes, so an error redirect is not confirmed as a success", async () => {
    const message = (location: string) =>
      location.includes("guardianError") ? null : "Tutor/a añadido/a";
    const failed = toastOnRedirect<State>(async () => {
      throw redirectError("/patients/p1?guardianError=already");
    }, message);
    const added = toastOnRedirect<State>(async () => {
      throw redirectError("/patients/p1");
    }, message);

    await expect(failed(undefined, new FormData())).rejects.toThrow();
    expect(toast).not.toHaveBeenCalled();
    await expect(added(undefined, new FormData())).rejects.toThrow();
    expect(toast).toHaveBeenCalledWith("Tutor/a añadido/a");
  });

  it("says nothing when the action returns an error or warnings, as nothing was saved", async () => {
    const action = toastOnRedirect<State>(
      async () => ({ error: "Elige un profesional." }),
      "Cita creada",
    );

    expect(await action(undefined, new FormData())).toEqual({
      error: "Elige un profesional.",
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("says nothing when the request itself fails, as the save did not happen", async () => {
    const action = toastOnRedirect<State>(async () => {
      throw new TypeError("Failed to fetch");
    }, "Cita creada");

    await expect(action(undefined, new FormData())).rejects.toThrow(
      "Failed to fetch",
    );
    expect(toast).not.toHaveBeenCalled();
  });
});
