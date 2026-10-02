import type { createAdminClient } from "@clinicalumia/api/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const USERS_PAGE = 1000;
const LOOKUP_CHUNK = 100;
const MAX_DELETIONS = 100;
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type AuthUser = {
  id: string;
  created_at: string;
  last_sign_in_at?: string | null;
  invited_at?: string | null;
  recovery_sent_at?: string | null;
};

function neverVerified(user: AuthUser, cutoff: number) {
  return (
    !user.last_sign_in_at &&
    !user.invited_at &&
    new Date(user.created_at).getTime() < cutoff &&
    (!user.recovery_sent_at ||
      new Date(user.recovery_sent_at).getTime() < cutoff)
  );
}

async function listAllUsers(admin: AdminClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE,
    });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < USERS_PAGE) return users;
  }
}

async function idsWithRows(
  admin: AdminClient,
  table: "profiles" | "patient_accounts",
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let start = 0; start < ids.length; start += LOOKUP_CHUNK) {
    const { data, error } = await admin
      .from(table)
      .select("id")
      .in("id", ids.slice(start, start + LOOKUP_CHUNK));
    if (error || !data) throw new Error(error?.message ?? table);
    for (const row of data) found.add(row.id);
  }
  return found;
}

async function stillNeverVerified(
  admin: AdminClient,
  id: string,
  cutoff: number,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) return false;
  return neverVerified(data.user, cutoff);
}

export async function deleteUnverifiedAccounts({
  admin,
  now,
}: {
  admin: AdminClient;
  now: Date;
}): Promise<{ deleted: number; failed: number } | { tooMany: number }> {
  const cutoff = now.getTime() - GRACE_MS;
  const candidateIds = (await listAllUsers(admin))
    .filter((user) => neverVerified(user, cutoff))
    .map((user) => user.id);

  const [staff, patients] = await Promise.all([
    idsWithRows(admin, "profiles", candidateIds),
    idsWithRows(admin, "patient_accounts", candidateIds),
  ]);
  const doomed = candidateIds.filter(
    (id) => !staff.has(id) && !patients.has(id),
  );

  if (doomed.length > MAX_DELETIONS) {
    console.error(
      `Limpieza de cuentas sin verificar parada: ${doomed.length} candidatas superan el máximo de ${MAX_DELETIONS}.`,
    );
    return { tooMany: doomed.length };
  }

  let deleted = 0;
  let failed = 0;
  for (const id of doomed) {
    if (!(await stillNeverVerified(admin, id, cutoff))) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      failed += 1;
      console.error(`No se ha podido borrar la cuenta ${id}: ${error.message}`);
    } else {
      deleted += 1;
    }
  }
  console.info(
    `Limpieza de cuentas sin verificar: ${JSON.stringify({ deleted, failed })}`,
  );
  return { deleted, failed };
}
