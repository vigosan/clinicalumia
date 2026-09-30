import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeConsent = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/consent-store", () => ({ storeConsent }));
vi.mock("@clinicalumia/api/email", () => ({ sendEmail }));
vi.mock("@clinicalumia/api/admin", () => ({
  createAdminClient: () => "admin-client",
}));

const { sendConsent } = await import("./actions");

const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAEElEQVR4nGNgYGD4j4ZRBQB7pgf5fzpslgAAAABJRU5ErkJggg==";

function consentForm(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    firstName: "Ana",
    lastName: "García López",
    guardian: "",
    birthDate: "1990-05-10",
    dni: "12345678Z",
    email: "ana@example.com",
    source: "Familiares o amigos",
    privacy: "on",
    signature,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("sendConsent", () => {
  beforeEach(() => {
    storeConsent.mockReset();
    sendEmail.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the signed consent even when the notification email later fails, so a signature is never lost over a mail outage", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });
    sendEmail.mockRejectedValue(new Error("resend down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("tells the signer to try again when the consent itself cannot be saved, without emailing the clinic", async () => {
    storeConsent.mockRejectedValue(new Error("db down"));

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({
      error: "No se ha podido guardar el consentimiento. Inténtalo de nuevo.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("logs why a consent could not be saved, so the clinic can find out why signatures are being lost", async () => {
    const failure = new Error("db down");
    storeConsent.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendConsent(undefined, consentForm());

    expect(errorSpy).toHaveBeenCalledWith(
      "No se ha podido guardar el consentimiento",
      failure,
    );
  });

  it("ignores a filled honeypot field without storing or emailing anything", async () => {
    const result = await sendConsent(
      undefined,
      consentForm({ website: "http://spam.example" }),
    );

    expect(result).toEqual({ ok: true });
    expect(storeConsent).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
