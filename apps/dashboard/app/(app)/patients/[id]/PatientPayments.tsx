import { Button } from "@clinicalumia/ui/button";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import Link from "next/link";
import { formatMadridDateTime } from "@/lib/madrid-format";
import { MAX_ROWS, type PatientPaymentRow } from "@/lib/patient-appointments";
import type { PaymentCandidate } from "@/lib/payment-candidates";
import { formatEuros } from "@/lib/payments";
import { RegisterPaymentDialog } from "../../cobros/RegisterPaymentDialog";

export function PatientPayments({
  error,
  toCollect,
  payments,
  truncated,
  now,
}: {
  error: boolean;
  toCollect: PaymentCandidate[];
  payments: PatientPaymentRow[];
  truncated: boolean;
  now: string;
}) {
  if (error) {
    return (
      <p
        role="alert"
        data-testid="patient-payments-error"
        className="text-[13px] text-danger-600"
      >
        No se han podido cargar los cobros. Recarga la página.
      </p>
    );
  }

  if (toCollect.length === 0 && payments.length === 0) {
    return <p className="text-sm text-ink-800">Todavía no tiene cobros.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {toCollect.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={eyebrowClass}>Pendientes de cobro</h3>
          <ul className="flex flex-col gap-2">
            {toCollect.map((candidate) => (
              <li
                key={candidate.id}
                data-testid="patient-pending-payment"
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-line px-3 py-2 text-[15px] text-ink-900"
              >
                <span>
                  {formatMadridDateTime(candidate.startsAt)} ·{" "}
                  {candidate.serviceName} · {candidate.professionalName}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[13px] text-ink-800 tabular-nums">
                    {formatEuros(candidate.suggestedAmountCents)}
                  </span>
                  <RegisterPaymentDialog
                    trigger={
                      <Button size="sm" data-testid="patient-collect">
                        Cobrar
                      </Button>
                    }
                    now={now}
                    preselected={candidate}
                    focusAfterSuccess="#patient-payments-title"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {payments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={eyebrowClass}>Registrados</h3>
          <ul className="flex flex-col gap-2">
            {payments.map((payment) => (
              <li key={payment.id}>
                <Link
                  href={payment.href}
                  data-testid="patient-payment"
                  className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-line px-3 py-2 text-[15px] text-ink-900 hover:bg-cream-200 ${payment.voided ? "opacity-60" : ""}`}
                >
                  <span>
                    {payment.date} · {payment.serviceName}
                    {payment.appointmentDate !== payment.date &&
                      ` · cita del ${payment.appointmentDate}`}
                  </span>
                  <span className="text-[13px] text-ink-800">
                    {payment.amountLabel} · {payment.stateLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {truncated && (
            <p className="text-[13px] text-ink-800">
              Se muestran solo los {MAX_ROWS} más recientes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
