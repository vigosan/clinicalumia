import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { passesCaptcha, turnstileSiteKey } from "./turnstile";

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

describe("passesCaptcha", () => {
  it("lets every form through without calling Cloudflare while the keys are not configured", async () => {
    expect(await passesCaptcha(solvedForm(null))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the form through without calling Cloudflare when only the secret is configured, because nobody could solve a captcha that is not shown", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "clave-secreta");

    expect(await passesCaptcha(solvedForm(null))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a form without an answer when the captcha is on, without asking Cloudflare", async () => {
    withKeys();

    expect(await passesCaptcha(solvedForm(null))).toBe(false);
    expect(await passesCaptcha(solvedForm(""))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Cloudflare with the secret and the answer, and accepts a valid one", async () => {
    withKeys();
    fetchMock.mockResolvedValue(Response.json({ success: true }));

    expect(await passesCaptcha(solvedForm("respuesta"))).toBe(true);

    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body);
    expect(body.get("secret")).toBe("clave-secreta");
    expect(body.get("response")).toBe("respuesta");
  });

  it("rejects an answer Cloudflare does not accept", async () => {
    withKeys();
    fetchMock.mockResolvedValue(
      Response.json({ success: false, "error-codes": ["invalid-input"] }),
    );

    expect(await passesCaptcha(solvedForm("falsa"))).toBe(false);
  });

  it("rejects the answer when Cloudflare cannot be asked, rather than letting unchecked forms through", async () => {
    withKeys();
    fetchMock.mockResolvedValue(new Response("error", { status: 500 }));

    expect(await passesCaptcha(solvedForm("respuesta"))).toBe(false);
  });
});
