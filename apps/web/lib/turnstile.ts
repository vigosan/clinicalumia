const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const CAPTCHA_FAILED =
  "No hemos podido comprobar que no eres un robot. Inténtalo de nuevo.";

function keys() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  return siteKey && secret ? { siteKey, secret } : undefined;
}

export function turnstileSiteKey() {
  return keys()?.siteKey;
}

export async function passesCaptcha(formData: FormData) {
  const configured = keys();
  if (!configured) return true;

  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) return false;

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    body: new URLSearchParams({ secret: configured.secret, response: token }),
  });
  if (!response.ok) return false;
  const result: { success?: boolean } = await response.json();
  return result.success === true;
}
