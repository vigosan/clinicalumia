import type { createClient } from "@clinicalumia/api/server";
import {
  type DbError,
  needsViewer,
  type PaymentFailure,
  paymentError,
  paymentFailure,
} from "./payments";

type Client = Awaited<ReturnType<typeof createClient>>;

export function adminUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3002";
}

export async function failureFor(
  supabase: Client,
  error: DbError,
): Promise<PaymentFailure> {
  if (!needsViewer(error)) return { error: paymentError(error) };
  const { data: isOwner } = await supabase.rpc("is_owner");
  return paymentFailure(error, {
    isOwner: isOwner === true,
    adminUrl: adminUrl(),
  });
}
