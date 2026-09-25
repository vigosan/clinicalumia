import { createClient } from "@supabase/supabase-js";
import { validateOwnerPassword } from "./password";

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
  const password = readEnv("OWNER_PASSWORD");
  const fullName = readEnv("OWNER_FULL_NAME");

  const passwordError = validateOwnerPassword(password);
  if (passwordError) {
    console.error(passwordError);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    console.log(
      `Profile already exists for ${email} (role=${existing.role}). Nothing to do.`,
    );
    return;
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    console.error("Failed to create auth user:", createError?.message);
    process.exit(1);
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    email: email.toLowerCase(),
    full_name: fullName,
    role: "owner",
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    console.error("Failed to create profile:", profileError.message);
    process.exit(1);
  }

  console.log(`Owner created: ${email} (${fullName})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
