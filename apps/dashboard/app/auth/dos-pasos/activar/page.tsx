import { TwoFactorSetup } from "@clinicalumia/ui/two-factor-setup";
import { confirmEnrollment, logout, startEnrollment } from "../actions";

export default function ActivarPage() {
  return (
    <TwoFactorSetup
      startAction={startEnrollment}
      confirmAction={confirmEnrollment}
      logoutAction={logout}
    />
  );
}
