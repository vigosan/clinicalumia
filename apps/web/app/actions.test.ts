import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeConsent = vi.fn();
const sendEmail = vi.fn();
const recordAttempt = vi.fn();
const attemptsInHour = vi.fn();
const forgetAttempt = vi.fn();
const purgeOldAttempts = vi.fn();

vi.mock("@/lib/consent-store", () => ({ storeConsent }));
vi.mock("@clinicalumia/api/email", () => ({ sendEmail }));
vi.mock("@clinicalumia/api/admin", () => ({
  createAdminClient: () => "admin-client",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/access-attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access-attempts")>()),
  recordAttempt,
  attemptsInHour,
  forgetAttempt,
  purgeOldAttempts,
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

function consentsInHour({
  fromNetwork,
  overall,
}: {
  fromNetwork: number;
  overall: number;
}) {
  attemptsInHour.mockImplementation(
    async (
      _admin: unknown,
      _kind: string,
      _until: string,
      match: { ip_hash?: string },
    ) => (match.ip_hash ? fromNetwork : overall),
  );
}

describe("sendConsent", () => {
  beforeEach(() => {
    storeConsent.mockReset();
    sendEmail.mockReset();
    recordAttempt.mockReset();
    recordAttempt.mockResolvedValue({
      id: "intento-1",
      created_at: "2026-10-02T10:00:00.000Z",
    });
    forgetAttempt.mockReset();
    consentsInHour({ fromNetwork: 1, overall: 1 });
    vi.stubEnv("ACCESS_IP_SALT", "sal-de-prueba");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("counts each consent against a salted hash of the signer's network only, without keeping their email in the limits table, since no limit needs it", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(undefined, consentForm());

    expect(recordAttempt).toHaveBeenCalledWith(
      "admin-client",
      "consent",
      null,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("purges attempts older than a day, so the limits table never keeps more than the limits need even when nobody asks for an access code", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(undefined, consentForm());

    expect(purgeOldAttempts).toHaveBeenCalledWith(
      "admin-client",
      "2026-10-02T10:00:00.000Z",
    );
  });

  it("stops the sixteenth consent in an hour from the same network before storing or emailing, and gives the clinic phone", async () => {
    consentsInHour({ fromNetwork: 16, overall: 16 });

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({
      error:
        "Se han enviado muchos consentimientos desde esta conexión. Inténtalo dentro de una hora o llama al 614 552 808.",
    });
    expect(storeConsent).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still accepts the fifteenth consent in an hour from the same network, because reception signs several patients in a row on the clinic tablet or wifi", async () => {
    consentsInHour({ fromNetwork: 15, overall: 15 });
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({ ok: true });
  });

  it("stops every consent once thirty were sent in the last hour, so a flood cannot spend the email quota the patients' confirmations need", async () => {
    consentsInHour({ fromNetwork: 1, overall: 31 });

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({
      error:
        "Ahora mismo hay muchas peticiones. Inténtalo en unos minutos o llama al 614 552 808.",
    });
    expect(storeConsent).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("forgets a stopped consent, so one network hammering the form cannot lock everyone else out", async () => {
    consentsInHour({ fromNetwork: 16, overall: 16 });

    await sendConsent(undefined, consentForm());

    expect(forgetAttempt).toHaveBeenCalledWith("admin-client", "intento-1");
  });

  it("does not count a consent that fails validation, since nothing was stored or sent", async () => {
    await sendConsent(undefined, consentForm({ privacy: "" }));

    expect(recordAttempt).not.toHaveBeenCalled();
  });

  it("refuses the consent when the captcha is on and was not solved, before counting or storing anything", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "clave-del-sitio");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "clave-secreta");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: false })),
    );

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({
      error:
        "No hemos podido comprobar que no eres un robot. Inténtalo de nuevo.",
    });
    expect(recordAttempt).not.toHaveBeenCalled();
    expect(storeConsent).not.toHaveBeenCalled();
  });

  it("stores the consent when the captcha is on and was solved for the consent form", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "clave-del-sitio");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "clave-secreta");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "www.clinicalumia.es",
          action: "consentimiento",
        }),
      ),
    );
    storeConsent.mockResolvedValue({ id: "c1", personId: null });
    const form = consentForm();
    form.set("cf-turnstile-response", "token-bueno");

    await sendConsent(undefined, form);

    expect(storeConsent).toHaveBeenCalled();
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

  it("sends the signer a copy of the signed PDF when they leave an email, as their proof of what they signed", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(undefined, consentForm());

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        subject: "Tu consentimiento firmado · Clínica LUMIA",
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(
              /^consentimiento-12345678Z-\d{4}-\d{2}-\d{2}\.pdf$/,
            ),
            contentType: "application/pdf",
          }),
        ],
      }),
    );
  });

  it("sends the copy to the guardian's email when a minor's consent is signed by them", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(
      undefined,
      consentForm({
        birthDate: "2015-01-01",
        guardian: "Luis García",
        guardianDni: "X1234567L",
        dni: "",
        email: "luis@example.com",
      }),
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "luis@example.com" }),
    );
    const copy = sendEmail.mock.calls.find(
      ([email]) => email.to === "luis@example.com",
    )?.[0];
    expect(copy.html).toContain("Luis García");
  });

  it("only emails the clinic when the signer leaves no email", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(undefined, consentForm({ email: "" }));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "info@clinicalumia.es" }),
    );
  });

  it("still sends the signer's copy when the clinic's email fails, since the two are independent", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });
    sendEmail.mockRejectedValueOnce(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendConsent(undefined, consentForm());

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com" }),
    );
  });

  it("names the clinic's attachment only with letters and digits from the identifier", async () => {
    storeConsent.mockResolvedValue({ id: "c1", personId: null });

    await sendConsent(undefined, consentForm({ dni: "PAA-123.456" }));

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "info@clinicalumia.es",
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(
              /^consentimiento-PAA123456-\d{4}-\d{2}-\d{2}\.pdf$/,
            ),
          }),
        ],
      }),
    );
  });
});
