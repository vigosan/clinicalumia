import { safeNext } from "@clinicalumia/api/route";
import { TwoFactorChallenge } from "@clinicalumia/ui/two-factor-challenge";
import { logout, verifyChallenge } from "./actions";

export default async function DosPasosPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <TwoFactorChallenge
      action={verifyChallenge}
      next={safeNext(next ?? null)}
      logoutAction={logout}
    />
  );
}
