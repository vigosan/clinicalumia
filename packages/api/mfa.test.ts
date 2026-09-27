import { describe, expect, it, vi } from "vitest";
import {
  confirmTotpEnrollment,
  getMfaStep,
  parseTotpCode,
  startTotpEnrollment,
  verifyTotp,
} from "./mfa";

function fakeClient(currentLevel: string, nextLevel: string) {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel, nextLevel },
          error: null,
        }),
      },
    },
  } as unknown as Parameters<typeof getMfaStep>[0];
}

function fakeErrorClient() {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: null,
          error: { message: "network error" },
        }),
      },
    },
  } as unknown as Parameters<typeof getMfaStep>[0];
}

describe("getMfaStep", () => {
  it("marks a session that already passed the second factor as done", async () => {
    const step = await getMfaStep(fakeClient("aal2", "aal2"));
    expect(step).toBe("done");
  });

  it("sends a session with a verified factor to the challenge", async () => {
    const step = await getMfaStep(fakeClient("aal1", "aal2"));
    expect(step).toBe("challenge");
  });

  it("sends a session without any factor to enroll", async () => {
    const step = await getMfaStep(fakeClient("aal1", "aal1"));
    expect(step).toBe("enroll");
  });

  it("keeps a session done on currentLevel alone, even if nextLevel looks stale", async () => {
    const step = await getMfaStep(fakeClient("aal2", "aal1"));
    expect(step).toBe("done");
  });

  it("fails closed to enroll, never done, when the assurance level check errors", async () => {
    const step = await getMfaStep(fakeErrorClient());
    expect(step).toBe("enroll");
  });
});

describe("parseTotpCode", () => {
  it("removes the spaces an authenticator app groups the digits with", () => {
    expect(parseTotpCode("123 456")).toBe("123456");
  });

  it("rejects a code with fewer than 6 digits", () => {
    expect(parseTotpCode("12345")).toBeNull();
  });

  it("rejects anything that isn't digits", () => {
    expect(parseTotpCode("abcdef")).toBeNull();
  });
});

function fakeEnrollClient({
  factors = [],
  enrollError = null,
  qrCode = "<svg/>",
}: {
  factors?: { id: string; factor_type: string; status: string }[];
  enrollError?: { message: string } | null;
  qrCode?: string;
} = {}) {
  const unenroll = vi.fn(async () => ({ data: { id: "x" }, error: null }));
  const enroll = vi.fn(async () => ({
    data: enrollError
      ? null
      : {
          id: "new-factor",
          type: "totp",
          totp: {
            qr_code: qrCode,
            secret: "SECRET123",
            uri: "otpauth://totp/x",
          },
        },
    error: enrollError,
  }));
  const listFactors = vi.fn(async () => ({
    data: { all: factors },
    error: null,
  }));
  return {
    client: {
      auth: { mfa: { listFactors, enroll, unenroll } },
    } as unknown as Parameters<typeof startTotpEnrollment>[0],
    unenroll,
    enroll,
  };
}

describe("startTotpEnrollment", () => {
  it("unenrolls unverified totp factors before enrolling a new one", async () => {
    const { client, unenroll, enroll } = fakeEnrollClient({
      factors: [
        { id: "stale-1", factor_type: "totp", status: "unverified" },
        { id: "stale-2", factor_type: "totp", status: "unverified" },
      ],
    });

    const result = await startTotpEnrollment(client);

    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-2" });
    expect(enroll).toHaveBeenCalledOnce();
    expect(result).toEqual({
      factorId: "new-factor",
      qrCode: "data:image/svg+xml;utf-8,<svg/>",
      secret: "SECRET123",
    });
  });

  it("does not touch a factor that is already verified", async () => {
    const { client, unenroll } = fakeEnrollClient({
      factors: [{ id: "verified-1", factor_type: "totp", status: "verified" }],
    });

    await startTotpEnrollment(client);

    expect(unenroll).not.toHaveBeenCalled();
  });

  it("trims trailing whitespace from the QR svg, since Next's Image rejects a src ending in a control character", async () => {
    const { client } = fakeEnrollClient({
      qrCode: '<?xml version="1.0"?>\n<svg><rect /></svg>\n',
    });

    const result = await startTotpEnrollment(client);

    expect(result).toEqual({
      factorId: "new-factor",
      qrCode:
        'data:image/svg+xml;utf-8,<?xml version="1.0"?>\n<svg><rect /></svg>',
      secret: "SECRET123",
    });
  });

  it("reports a friendly error when Supabase refuses to enroll", async () => {
    const { client } = fakeEnrollClient({
      enrollError: { message: "boom" },
    });

    const result = await startTotpEnrollment(client);

    expect(result).toEqual({
      error: "No se ha podido preparar la verificación. Recarga la página.",
    });
  });
});

function fakeVerifyClient({
  verifiedFactorId = "verified-1",
  challengeError = null,
}: {
  verifiedFactorId?: string | null;
  challengeError?: { message: string } | null;
} = {}) {
  const challengeAndVerify = vi.fn(async () => ({
    data: challengeError ? null : { access_token: "t" },
    error: challengeError,
  }));
  const listFactors = vi.fn(async () => ({
    data: {
      all: [],
      totp: verifiedFactorId
        ? [{ id: verifiedFactorId, factor_type: "totp", status: "verified" }]
        : [],
    },
    error: null,
  }));
  return {
    client: {
      auth: { mfa: { listFactors, challengeAndVerify } },
    } as unknown as Parameters<typeof verifyTotp>[0],
    challengeAndVerify,
  };
}

describe("verifyTotp", () => {
  it("finds the verified factor and verifies the code against it", async () => {
    const { client, challengeAndVerify } = fakeVerifyClient({
      verifiedFactorId: "verified-1",
    });

    const result = await verifyTotp(client, "123456");

    expect(challengeAndVerify).toHaveBeenCalledWith({
      factorId: "verified-1",
      code: "123456",
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns the incorrect-code message when Supabase rejects the code, without throwing", async () => {
    const { client } = fakeVerifyClient({
      challengeError: { message: "invalid" },
    });

    const result = await verifyTotp(client, "000000");

    expect(result).toEqual({
      error: "El código no es correcto o ha caducado. Prueba con el siguiente.",
    });
  });

  it("fails closed when there is no verified factor to challenge", async () => {
    const { client } = fakeVerifyClient({ verifiedFactorId: null });

    const result = await verifyTotp(client, "123456");

    expect(result).toEqual({
      error: "No se ha podido preparar la verificación. Recarga la página.",
    });
  });
});

describe("confirmTotpEnrollment", () => {
  it("verifies the freshly enrolled factor with the given code", async () => {
    const challengeAndVerify = vi.fn(async () => ({
      data: { access_token: "t" },
      error: null,
    }));
    const client = {
      auth: { mfa: { challengeAndVerify } },
    } as unknown as Parameters<typeof confirmTotpEnrollment>[0];

    const result = await confirmTotpEnrollment(client, "new-factor", "123456");

    expect(challengeAndVerify).toHaveBeenCalledWith({
      factorId: "new-factor",
      code: "123456",
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns the incorrect-code message when Supabase rejects the code, without throwing", async () => {
    const challengeAndVerify = vi.fn(async () => ({
      data: null,
      error: { message: "invalid" },
    }));
    const client = {
      auth: { mfa: { challengeAndVerify } },
    } as unknown as Parameters<typeof confirmTotpEnrollment>[0];

    const result = await confirmTotpEnrollment(client, "new-factor", "000000");

    expect(result).toEqual({
      error: "El código no es correcto o ha caducado. Prueba con el siguiente.",
    });
  });
});
