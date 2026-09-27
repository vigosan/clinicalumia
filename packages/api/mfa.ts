import type { Database } from "@clinicalumia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaStep = "enroll" | "challenge" | "done";

const CODE_INCORRECT =
  "El código no es correcto o ha caducado. Prueba con el siguiente.";
const ENROLLMENT_FAILED =
  "No se ha podido preparar la verificación. Recarga la página.";

export async function getMfaStep(
  supabase: SupabaseClient<Database>,
): Promise<MfaStep> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return "done";
  if (data?.nextLevel === "aal2") return "challenge";
  return "enroll";
}

export function parseTotpCode(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

function toQrCodeSrc(qrCode: string): string {
  const trimmed = qrCode.trim();
  return trimmed.startsWith("data:")
    ? trimmed
    : `data:image/svg+xml;utf-8,${trimmed}`;
}

export async function startTotpEnrollment(
  supabase: SupabaseClient<Database>,
): Promise<
  { factorId: string; qrCode: string; secret: string } | { error: string }
> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const unverified =
    factors?.all.filter(
      (factor) =>
        factor.factor_type === "totp" && factor.status === "unverified",
    ) ?? [];

  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "App de autenticación",
  });
  if (error || !data) return { error: ENROLLMENT_FAILED };

  return {
    factorId: data.id,
    qrCode: toQrCodeSrc(data.totp.qr_code),
    secret: data.totp.secret,
  };
}

export async function confirmTotpEnrollment(
  supabase: SupabaseClient<Database>,
  factorId: string,
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { error: CODE_INCORRECT };
  return { ok: true };
}

export async function verifyTotp(
  supabase: SupabaseClient<Database>,
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) return { error: ENROLLMENT_FAILED };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (error) return { error: CODE_INCORRECT };
  return { ok: true };
}
