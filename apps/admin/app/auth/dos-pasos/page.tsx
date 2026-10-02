import { safeNext } from "@clinicalumia/api/route";
import { createClient } from "@clinicalumia/api/server";
import { TwoFactorChallenge } from "@clinicalumia/ui/two-factor-challenge";
import { logout, verifyChallenge } from "./actions";

export default async function DosPasosPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: owner } = await supabase.rpc("signed_in_as_owner");

  return (
    <TwoFactorChallenge
      action={verifyChallenge}
      next={safeNext(next ?? null)}
      logoutAction={logout}
      owner={owner === true}
    />
  );
}
