import { startTotpEnrollment } from "@clinicalumia/api/mfa";
import { createClient } from "@clinicalumia/api/server";
import { TwoFactorSetup } from "@clinicalumia/ui/two-factor-setup";
import { confirmEnrollment } from "../actions";

export default async function ActivarPage() {
  const supabase = await createClient();
  const result = await startTotpEnrollment(supabase);

  if ("error" in result) {
    return <p role="alert">{result.error}</p>;
  }

  return (
    <TwoFactorSetup
      qrCode={result.qrCode}
      secret={result.secret}
      factorId={result.factorId}
      action={confirmEnrollment}
    />
  );
}
