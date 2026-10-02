import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPTCHA_FAILED,
  CAPTCHA_UNAVAILABLE,
  captchaError,
  turnstileSiteKey,
} from "./turnstile";

const fetchMock = vi.fn();

function solvedForm(token: string | null) {
  const data = new FormData();
  if (token !== null) data.set("cf-turnstile-response", token);
  return data;
}

function withKeys() {
  vi.stubEnv("TURNSTILE_SITE_KEY", "clave-del-sitio");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "clave-secreta");
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SITE_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("turnstileSiteKey", () => {
  it("shows no captcha while the keys are not configured, so the forms work as they always did", () => {
    expect(turnstileSiteKey()).toBeUndefined();
  });

  it("shows no captcha with only the site key, since the server could not check the answer", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "clave-del-sitio");

    expect(turnstileSiteKey()).toBeUndefined();
  });

  it("shows the captcha once both keys are configured", () => {
    withKeys();

    expect(turnstileSiteKey()).toBe("clave-del-sitio");
  });
});

function verified(overrides: Record<string, unknown> = {}) {
  return Response.json({
    success: true,
    hostname: "www.clinicalumia.es",
    action: "acceder",
    ...overrides,
  });
}

describe("captchaError", () => {
  it("lets every form through without calling Cloudflare while the keys are not configured", async () => {
    expect(await captchaError(solvedForm(null), "acceder")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the form through without calling Cloudflare when only the secret is configured, because nobody could solve a captcha that is not shown", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "clave-secreta");

    expect(await captchaError(solvedForm(null), "acceder")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a form without an answer when the captcha is on, without asking Cloudflare, so a bot cannot skip the widget", async () => {
    withKeys();

    expect(await captchaError(solvedForm(null), "acceder")).toBe(
      CAPTCHA_FAILED,
    );
    expect(await captchaError(solvedForm(""), "acceder")).toBe(CAPTCHA_FAILED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Cloudflare with the secret and the answer, and accepts a valid one solved on our site for this form", async () => {
    withKeys();
    fetchMock.mockResolvedValue(verified());

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      undefined,
    );

    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body);
    expect(body.get("secret")).toBe("clave-secreta");
    expect(body.get("response")).toBe("respuesta");
  });

  it("accepts an answer solved on the bare domain too, since it redirects to www but both are ours", async () => {
    withKeys();
    fetchMock.mockResolvedValue(verified({ hostname: "clinicalumia.es" }));

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      undefined,
    );
  });

  it("rejects an answer Cloudflare does not accept", async () => {
    withKeys();
    fetchMock.mockResolvedValue(
      Response.json({ success: false, "error-codes": ["invalid-input"] }),
    );

    expect(await captchaError(solvedForm("falsa"), "acceder")).toBe(
      CAPTCHA_FAILED,
    );
  });

  it("rejects an answer solved on another site, so a token farmed elsewhere with our public key is useless", async () => {
    withKeys();
    fetchMock.mockResolvedValue(verified({ hostname: "otra-web.example" }));

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      CAPTCHA_FAILED,
    );
  });

  it("rejects an answer solved for the other form, so one solved captcha cannot be replayed on a different form", async () => {
    withKeys();
    fetchMock.mockResolvedValue(verified({ action: "consentimiento" }));

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      CAPTCHA_FAILED,
    );
  });

  it("gives up waiting for Cloudflare after a few seconds, so the form never hangs", async () => {
    withKeys();
    fetchMock.mockResolvedValue(verified());

    await captchaError(solvedForm("respuesta"), "acceder");

    const [, init] = fetchMock.mock.lastCall ?? [];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the form closed and offers the phone when Cloudflare answers with an error, rather than letting unchecked forms through", async () => {
    withKeys();
    fetchMock.mockResolvedValue(new Response("error", { status: 500 }));

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      CAPTCHA_UNAVAILABLE,
    );
    expect(CAPTCHA_UNAVAILABLE).toContain("614 552 808");
  });

  it("keeps the form closed and offers the phone when Cloudflare cannot be reached or times out", async () => {
    withKeys();
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted.", "TimeoutError"),
    );

    expect(await captchaError(solvedForm("respuesta"), "acceder")).toBe(
      CAPTCHA_UNAVAILABLE,
    );
  });
});
