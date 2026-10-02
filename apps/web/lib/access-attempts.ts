import { createHash } from "node:crypto";
import type { createAdminClient } from "@clinicalumia/api/admin";
import { site } from "./site";

type AdminClient = ReturnType<typeof createAdminClient>;
export type AttemptKind = "request" | "code_sent" | "failed_code" | "consent";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const BUSY = `Ahora mismo hay muchas peticiones. Inténtalo en unos minutos o llama al ${site.phone.display}.`;

export function hashIp(requestHeaders: Headers) {
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

export async function recordAttempt(
  admin: AdminClient,
  kind: AttemptKind,
  email: string | null,
  ipHash: string,
) {
  const { data, error } = await admin
    .from("access_requests")
    .insert({ email, ip_hash: ipHash, kind })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function attemptsInHour(
  admin: AdminClient,
  kind: AttemptKind,
  until: string,
  match: { email?: string; ip_hash?: string },
) {
  const since = new Date(new Date(until).getTime() - HOUR_MS).toISOString();
  let query = admin
    .from("access_requests")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind);
  if (match.email !== undefined) query = query.eq("email", match.email);
  if (match.ip_hash !== undefined) query = query.eq("ip_hash", match.ip_hash);
  const { count, error } = await query
    .gte("created_at", since)
    .lte("created_at", until);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function forgetAttempt(admin: AdminClient, id: string) {
  const { error } = await admin.from("access_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function purgeOldAttempts(admin: AdminClient, until: string) {
  const { error } = await admin
    .from("access_requests")
    .delete()
    .lt(
      "created_at",
      new Date(new Date(until).getTime() - DAY_MS).toISOString(),
    );
  if (error) throw new Error(error.message);
}
