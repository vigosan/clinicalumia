import type { SupabaseClient } from "@supabase/supabase-js";

const MAILPIT = "http://127.0.0.1:54324/api/v1";

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

export async function removePatients(admin: SupabaseClient, emails: string[]) {
  if (emails.length === 0) return;
  const { data: adults, error } = await admin
    .from("people")
    .select("id")
    .in("email", emails);
  if (error) throw error;
  const adultIds = adults.map((person) => person.id);
  const { data: wards, error: wardsError } = await admin
    .from("guardianships")
    .select("minor_id")
    .in("guardian_id", adultIds);
  if (wardsError) throw wardsError;
  for (const ids of [wards.map((ward) => ward.minor_id), adultIds]) {
    if (ids.length === 0) continue;
    const { error: appointmentsError } = await admin
      .from("appointments")
      .delete()
      .in("patient_id", ids);
    if (appointmentsError) throw appointmentsError;
    const { error: peopleError } = await admin
      .from("people")
      .delete()
      .in("id", ids);
    if (peopleError) throw peopleError;
  }
  for (const id of await userIdsWithEmails(admin, emails)) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;
  }
  const { error: requestsError } = await admin
    .from("access_requests")
    .delete()
    .in("email", emails);
  if (requestsError) throw requestsError;
  for (const email of emails) {
    await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
      { method: "DELETE" },
    );
  }
}
