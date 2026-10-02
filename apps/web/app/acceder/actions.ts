"use server";

import { createAdminClient } from "@clinicalumia/api/admin";
import { safeNext } from "@clinicalumia/api/route";
import { createClient } from "@clinicalumia/api/server";
import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  attemptsInHour,
  BUSY,
  forgetAttempt,
  hashIp,
  purgeOldAttempts,
  recordAttempt,
} from "@/lib/access-attempts";
import { STAFF_EMAIL } from "@/lib/booking";
import { site } from "@/lib/site";
import { CAPTCHA_FAILED, passesCaptcha } from "@/lib/turnstile";

export type AccessState = { error: string } | undefined;

type AdminClient = ReturnType<typeof createAdminClient>;
type ServerClient = Awaited<ReturnType<typeof createClient>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;
const MAX_CODES_PER_HOUR = 80;
const MAX_FAILED_CODES_PER_EMAIL_AND_IP = 5;
const MAX_FAILED_CODES_PER_EMAIL = 20;
const MAX_FAILED_CODES_PER_IP = 30;
const USERS_PAGE = 1000;
const TOO_MANY = `Demasiados intentos. Espera unos minutos o llama al ${site.phone.display}.`;
const ACCOUNT_FAILED = `No hemos podido abrir tu cuenta. Inténtalo de nuevo o llama al ${site.phone.display}.`;
const TOO_SOON = "For security purposes, you can only request this after";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nextFrom(formData: FormData) {
  return safeNext(field(formData, "next") || "/mi-cuenta");
}

async function findUserId(admin: AdminClient, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE,
    });
    if (error) throw new Error(error.message);
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < USERS_PAGE) {
      throw new Error("No se encuentra el usuario que ya existía.");
    }
  }
}

async function userIdFor(admin: AdminClient, email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (data.user) return data.user.id;
  if (error?.code !== "email_exists") {
    throw new Error(`No se ha podido crear la cuenta: ${error?.message}`);
  }
  return findUserId(admin, email);
}

async function hasPatientAccount(admin: AdminClient, email: string) {
  const { data, error } = await admin
    .from("patient_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

async function createPatientAccount(user: User) {
  const admin = createAdminClient();
  const { data: staff, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return "failed";
  if (staff) return "staff";

  const { error: upsertError } = await admin
    .from("patient_accounts")
    .upsert(
      { id: user.id, email: user.email!.toLowerCase() },
      { onConflict: "id", ignoreDuplicates: true },
    );
  return upsertError ? "failed" : "opened";
}

async function openPatientAccount(supabase: ServerClient, user: User) {
  const outcome = await createPatientAccount(user);
  if (outcome !== "opened") await supabase.auth.signOut({ scope: "local" });
  return outcome;
}

function sentRecently(error: { code?: string; message: string }) {
  return (
    error.code === "over_email_send_rate_limit" &&
    error.message.startsWith(TOO_SOON)
  );
}

export async function requestAccess(
  _prev: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const email = field(formData, "email").toLowerCase();
  const next = nextFrom(formData);
  if (!EMAIL.test(email)) return { error: "Escribe un email válido." };
  if (!(await passesCaptcha(formData))) return { error: CAPTCHA_FAILED };

  const ipHash = hashIp(await headers());
  const admin = createAdminClient();
  const attempt = await recordAttempt(admin, "request", email, ipHash);
  await purgeOldAttempts(admin, attempt.created_at);
  const [byEmail, byIp] = await Promise.all([
    attemptsInHour(admin, "request", attempt.created_at, { email }),
    attemptsInHour(admin, "request", attempt.created_at, { ip_hash: ipHash }),
  ]);
  if (byEmail > MAX_PER_EMAIL || byIp > MAX_PER_IP) {
    return { error: TOO_MANY };
  }

  const { data: staff, error: staffError } = await admin
    .from("profiles")
    .select("id, email");
  if (staffError) throw new Error(staffError.message);
  if (staff.some((profile) => profile.email.toLowerCase() === email)) {
    return { error: STAFF_EMAIL };
  }

  const sent = await recordAttempt(admin, "code_sent", email, ipHash);
  if (
    (await attemptsInHour(admin, "code_sent", sent.created_at, {})) >
    MAX_CODES_PER_HOUR
  ) {
    await forgetAttempt(admin, sent.id);
    return { error: BUSY };
  }

  if (!(await hasPatientAccount(admin, email))) {
    const id = await userIdFor(admin, email);
    if (staff.some((profile) => profile.id === id)) {
      await forgetAttempt(admin, sent.id);
      return { error: STAFF_EMAIL };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${site.url}/acceder/confirmar?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) await forgetAttempt(admin, sent.id);
  if (error && !sentRecently(error)) {
    if (error.status === 429) return { error: TOO_MANY };
    return { error: "No hemos podido enviarte el email. Inténtalo de nuevo." };
  }

  redirect(`/acceder/codigo?${new URLSearchParams({ email, next })}`);
}

export async function verifyCode(
  _prev: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const email = field(formData, "email").toLowerCase();
  const ipHash = hashIp(await headers());
  const admin = createAdminClient();
  const attempt = await recordAttempt(admin, "failed_code", email, ipHash);
  const [byEmailAndIp, byEmail, byIp] = await Promise.all([
    attemptsInHour(admin, "failed_code", attempt.created_at, {
      email,
      ip_hash: ipHash,
    }),
    attemptsInHour(admin, "failed_code", attempt.created_at, { email }),
    attemptsInHour(admin, "failed_code", attempt.created_at, {
      ip_hash: ipHash,
    }),
  ]);
  if (
    byEmailAndIp > MAX_FAILED_CODES_PER_EMAIL_AND_IP ||
    byEmail > MAX_FAILED_CODES_PER_EMAIL ||
    byIp > MAX_FAILED_CODES_PER_IP
  ) {
    await forgetAttempt(admin, attempt.id);
    return { error: TOO_MANY };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: field(formData, "code"),
    type: "email",
  });
  if (error) return { error: "El código no es correcto o ha caducado." };

  await forgetAttempt(admin, attempt.id);
  const outcome = await openPatientAccount(supabase, data.user!);
  if (outcome === "staff") return { error: STAFF_EMAIL };
  if (outcome === "failed") return { error: ACCOUNT_FAILED };

  redirect(nextFrom(formData));
}

export async function confirmLink(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: field(formData, "token_hash"),
    type: "email",
  });
  if (error) redirect("/acceder?caducado=1");
  else {
    const outcome = await openPatientAccount(supabase, data.user!);
    if (outcome === "opened") redirect(nextFrom(formData));
    else if (outcome === "staff") redirect("/acceder");
    else redirect("/acceder?caducado=1");
  }
}
