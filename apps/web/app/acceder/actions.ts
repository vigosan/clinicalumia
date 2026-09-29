"use server";

import { createHash } from "node:crypto";
import { createAdminClient } from "@clinicalumia/api/admin";
import { safeNext } from "@clinicalumia/api/route";
import { createClient } from "@clinicalumia/api/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_EMAIL } from "@/lib/booking";
import { site } from "@/lib/site";

export type AccessState = { error: string } | undefined;

type AdminClient = ReturnType<typeof createAdminClient>;
type AttemptKind = "request" | "failed_code";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;
const MAX_FAILED_CODES_PER_EMAIL = 5;
const MAX_FAILED_CODES_PER_IP = 30;
const USERS_PAGE = 1000;
const TOO_MANY = "Demasiados intentos. Espera unos minutos.";
const TOO_SOON = "For security purposes, you can only request this after";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nextFrom(formData: FormData) {
  return safeNext(field(formData, "next") || null);
}

function hashIp(requestHeaders: Headers) {
  const salt = process.env.ACCESS_IP_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("Falta ACCESS_IP_SALT en el servidor.");
  }
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  return createHash("sha256")
    .update(`${salt ?? ""}:${ip}`)
    .digest("hex");
}

async function attemptsInHour(
  admin: AdminClient,
  kind: AttemptKind,
  column: "email" | "ip_hash",
  value: string,
  until: string,
) {
  const since = new Date(new Date(until).getTime() - HOUR_MS).toISOString();
  const { count, error } = await admin
    .from("access_requests")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq(column, value)
    .gte("created_at", since)
    .lte("created_at", until);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function recordAttempt(
  admin: AdminClient,
  kind: AttemptKind,
  email: string,
  ipHash: string,
) {
  const { data, error } = await admin
    .from("access_requests")
    .insert({ email, ip_hash: ipHash, kind })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);

  const [byEmail, byIp] = await Promise.all([
    attemptsInHour(admin, kind, "email", email, data.created_at),
    attemptsInHour(admin, kind, "ip_hash", ipHash, data.created_at),
  ]);
  return { ...data, byEmail, byIp };
}

async function purgeOldAttempts(admin: AdminClient, until: string) {
  const { error } = await admin
    .from("access_requests")
    .delete()
    .lt(
      "created_at",
      new Date(new Date(until).getTime() - DAY_MS).toISOString(),
    );
  if (error) throw new Error(error.message);
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

async function ensurePatientAccount(
  admin: AdminClient,
  email: string,
  staffIds: string[],
): Promise<AccessState> {
  const { data: account, error } = await admin
    .from("patient_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (account) return undefined;

  const id = await userIdFor(admin, email);
  if (staffIds.includes(id)) return { error: STAFF_EMAIL };

  const { error: upsertError } = await admin
    .from("patient_accounts")
    .upsert({ id, email }, { onConflict: "id", ignoreDuplicates: true });
  if (upsertError) throw new Error(upsertError.message);
  return undefined;
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

  const requestHeaders = await headers();
  const admin = createAdminClient();
  const attempt = await recordAttempt(
    admin,
    "request",
    email,
    hashIp(requestHeaders),
  );
  await purgeOldAttempts(admin, attempt.created_at);
  if (attempt.byEmail > MAX_PER_EMAIL || attempt.byIp > MAX_PER_IP) {
    return { error: TOO_MANY };
  }

  const { data: staff, error: staffError } = await admin
    .from("profiles")
    .select("id, email");
  if (staffError) throw new Error(staffError.message);
  if (staff.some((profile) => profile.email.toLowerCase() === email)) {
    return { error: STAFF_EMAIL };
  }

  const rejected = await ensurePatientAccount(
    admin,
    email,
    staff.map((profile) => profile.id),
  );
  if (rejected) return rejected;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${site.url}/acceder/confirmar?next=${encodeURIComponent(next)}`,
    },
  });
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
  const admin = createAdminClient();
  const attempt = await recordAttempt(
    admin,
    "failed_code",
    email,
    hashIp(await headers()),
  );
  if (
    attempt.byEmail > MAX_FAILED_CODES_PER_EMAIL ||
    attempt.byIp > MAX_FAILED_CODES_PER_IP
  ) {
    return { error: TOO_MANY };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: field(formData, "code"),
    type: "email",
  });
  if (error) return { error: "El código no es correcto o ha caducado." };

  const { error: deleteError } = await admin
    .from("access_requests")
    .delete()
    .eq("id", attempt.id);
  if (deleteError) throw new Error(deleteError.message);

  redirect(nextFrom(formData));
}

export async function confirmLink(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: field(formData, "token_hash"),
    type: "email",
  });
  redirect(error ? "/acceder?caducado=1" : nextFrom(formData));
}
