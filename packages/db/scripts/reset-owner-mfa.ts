import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ResetOwnerMfaResult =
  | { ok: true; removed: number }
  | { ok: false; error: string };

export async function resetOwnerMfa(
  supabase: SupabaseClient,
  rawEmail: string,
): Promise<ResetOwnerMfaResult> {
  const email = rawEmail.trim().toLowerCase();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (profileError) return { ok: false, error: profileError.message };
  if (!profile)
    return {
      ok: false,
      error: `No hay ninguna cuenta del equipo con el email ${email}.`,
    };
  if (profile.role !== "owner")
    return {
      ok: false,
      error: `${email} no es la propietaria. Su verificación la restablece la propietaria desde Admin › Equipo.`,
    };

  const { data, error: listError } = await supabase.auth.admin.mfa.listFactors({
    userId: profile.id,
  });
  if (listError) return { ok: false, error: listError.message };

  for (const factor of data.factors) {
    const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: profile.id,
    });
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  const { error: revokeError } = await supabase.rpc("revoke_user_sessions", {
    target: profile.id,
  });
  if (revokeError)
    return {
      ok: false,
      error: `Se han borrado los factores, pero no se han podido cerrar sus sesiones: ${revokeError.message}`,
    };

  return { ok: true, removed: data.factors.length };
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = readEnv("OWNER_EMAIL");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await resetOwnerMfa(supabase, email);

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(
    `Verificación en dos pasos restablecida para ${email.trim().toLowerCase()}: ${result.removed} factor(es) borrado(s) y sesiones cerradas. Al entrar tendrá que configurarla de nuevo.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
