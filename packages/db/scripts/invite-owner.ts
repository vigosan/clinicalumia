import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type InviteOwnerParams = {
  email: string;
  fullName: string;
  redirectTo: string;
};

export type InviteOwnerResult =
  | { ok: true; created: true }
  | { ok: true; created: false; message: string }
  | { ok: false; error: string };

export async function inviteOwner(
  supabase: SupabaseClient,
  { email, fullName, redirectTo }: InviteOwnerParams,
): Promise<InviteOwnerResult> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      created: false,
      message: `Profile already exists for ${email}. Nothing to do.`,
    };
  }

  const { data: invited, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError || !invited.user) {
    return {
      ok: false,
      error: inviteError?.message ?? "No se ha podido invitar.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: invited.user.id,
    email: email.toLowerCase(),
    full_name: fullName,
    role: "owner",
    is_active: true,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(invited.user.id);
    return { ok: false, error: profileError.message };
  }

  return { ok: true, created: true };
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
  const fullName = readEnv("OWNER_FULL_NAME");
  const redirectTo = readEnv("REDIRECT_TO");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await inviteOwner(supabase, { email, fullName, redirectTo });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  if (!result.created) {
    console.log(result.message);
    return;
  }

  console.log(`Owner invited: ${email} (${fullName})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
