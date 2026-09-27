import { beforeEach, describe, expect, it, vi } from "vitest";

let mfaStep: "enroll" | "challenge" | "done" = "enroll";
const enrollment = {
  factorId: "factor-1",
  qrCode: "data:image/svg+xml;utf-8,<svg/>",
  secret: "SECRET123",
  uri: "otpauth://totp/x",
};
const startTotpEnrollmentMock = vi.fn(async () => enrollment);

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({}),
}));
vi.mock("@clinicalumia/api/mfa", () => ({
  getMfaStep: async () => mfaStep,
  startTotpEnrollment: startTotpEnrollmentMock,
  confirmTotpEnrollment: vi.fn(),
  parseTotpCode: vi.fn(),
  verifyTotp: vi.fn(),
}));

const { startEnrollment } = await import("./actions");

describe("startEnrollment action", () => {
  beforeEach(() => {
    mfaStep = "enroll";
    startTotpEnrollmentMock.mockClear();
  });

  it("starts enrollment for a session that has no factor yet", async () => {
    const result = await startEnrollment();
    expect(result).toEqual(enrollment);
    expect(startTotpEnrollmentMock).toHaveBeenCalledOnce();
  });

  it("refuses to enroll a new factor for an aal1 session that still has a verified one pending, closing the recovery-link takeover gap", async () => {
    mfaStep = "challenge";
    const result = await startEnrollment();
    expect(result).toEqual({
      error: "No puedes activar la verificación desde aquí.",
    });
    expect(startTotpEnrollmentMock).not.toHaveBeenCalled();
  });

  it("refuses to enroll for a session that has already completed the second factor", async () => {
    mfaStep = "done";
    const result = await startEnrollment();
    expect(result).toEqual({
      error: "No puedes activar la verificación desde aquí.",
    });
    expect(startTotpEnrollmentMock).not.toHaveBeenCalled();
  });
});
