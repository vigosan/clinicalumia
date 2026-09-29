import type { SupabaseClient } from "@supabase/supabase-js";

export async function userIdsWithEmails(
  admin: SupabaseClient,
  emails: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    if (data.users.length === 0) return ids;
    for (const user of data.users) {
      if (user.email && emails.includes(user.email)) ids.push(user.id);
    }
  }
}
