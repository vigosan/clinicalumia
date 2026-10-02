import { site } from "./site";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;
const HOSTNAMES = ["clinicalumia.es", "www.clinicalumia.es"];

export type CaptchaAction = "acceder" | "consentimiento";

export const CAPTCHA_FAILED =
  "No hemos podido comprobar que no eres un robot. Inténtalo de nuevo.";

export const CAPTCHA_UNAVAILABLE = `Ahora mismo no podemos comprobar que no eres un robot. Inténtalo en unos minutos o llama al ${site.phone.display}.`;

function keys() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (Boolean(siteKey) !== Boolean(secret)) {
    const missing = siteKey ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY";
    console.warn(`Captcha apagado: falta ${missing}.`);
  }
  return siteKey && secret ? { siteKey, secret } : undefined;
}

export function turnstileSiteKey() {
  return keys()?.siteKey;
}

type Verification = { success?: boolean; hostname?: string; action?: string };

export async function captchaError(
  formData: FormData,
  action: CaptchaAction,
): Promise<string | undefined> {
  const configured = keys();
  if (!configured) return undefined;

  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) return CAPTCHA_FAILED;

  let result: Verification;
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: configured.secret, response: token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return CAPTCHA_UNAVAILABLE;
    result = await response.json();
  } catch {
    return CAPTCHA_UNAVAILABLE;
  }

  const passes =
    result.success === true &&
    HOSTNAMES.includes(result.hostname ?? "") &&
    result.action === action;
  return passes ? undefined : CAPTCHA_FAILED;
}
