import { TwoFactorSetup } from "@clinicalumia/ui/two-factor-setup";
import { confirmEnrollment, startEnrollment } from "../actions";

export default function ActivarPage() {
  return (
    <TwoFactorSetup
      startAction={startEnrollment}
      confirmAction={confirmEnrollment}
    />
  );
}
