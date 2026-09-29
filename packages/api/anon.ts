import "server-only";
import type { Database } from "@clinicalumia/db";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
