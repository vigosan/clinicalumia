"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { Textarea } from "@clinicalumia/ui/textarea";
import { useRef, useState, useTransition } from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { issueRectifyingInvoice } from "../facturas/actions";
import { voidPayment } from "../payments/actions";

export function VoidPaymentDialog({
  paymentId,
  invoiceId,
  triggerLabel = "Anular cobro",
  triggerTestId = "payment-void",
}: {
  paymentId: string;
  invoiceId: string | null;
  triggerLabel?: string;
  triggerTestId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleConfirm() {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = invoiceId
        ? await issueRectifyingInvoice(invoiceId, reason)
        : await voidPayment(paymentId, reason);
      submitGateRef.current.finish();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpen(false);
    });
  }

  return (
    <ConfirmDialog
      tone="destructive"
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={triggerTestId}
        >
          {triggerLabel}
        </Button>
      }
      title={
        invoiceId
          ? "¿Emitir rectificativa y anular cobro?"
          : "¿Anular este cobro?"
      }
      description={
        invoiceId
          ? "El cobro tiene factura: se emitirá una factura rectificativa por el mismo importe en negativo, el cobro quedará anulado en el historial y se podrá volver a cobrar."
          : "El cobro quedará anulado en el historial y se podrá volver a cobrar."
      }
      confirmLabel={
        pending
          ? "Anulando…"
          : invoiceId
            ? "Emitir rectificativa y anular cobro"
            : "Anular cobro"
      }
      cancelLabel="Volver"
      confirmTestId="payment-void-confirm"
      open={open}
      onOpenChange={setOpen}
      closeOnConfirm={false}
      confirmDisabled={pending}
      onConfirm={handleConfirm}
    >
      <Field label="Motivo de la anulación">
        <Textarea
          data-testid="payment-void-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {error && (
        <p
          role="alert"
          data-testid="payment-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
