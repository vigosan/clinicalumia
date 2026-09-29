"use server";

import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";

export async function signOutOfAccount(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
