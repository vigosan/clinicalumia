import { createClient } from "@clinicalumia/api/server";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export async function requirePatientPage(path: string): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/acceder?next=${encodeURIComponent(path)}`);
  return user;
}
