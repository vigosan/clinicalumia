"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { Textarea } from "@clinicalumia/ui/textarea";
import { toast } from "@clinicalumia/ui/toast";
import { useRef, useState, useTransition } from "react";
import type { PaymentFailure } from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { issueRectifyingInvoice } from "../facturas/actions";
import { voidPayment } from "../payments/actions";
import { ActionError } from "./ActionError";

export function VoidPaymentDialog({
  paymentId,
  invoiceId,
  triggerLabel = "Anular cobro",
  triggerTestId = "payment-void",
  open: openProp,
  onOpenChange,
}: {
  paymentId: string;
  invoiceId: string | null;
  triggerLabel?: string;
  triggerTestId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = openProp ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<PaymentFailure | null>(null);
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
        setFailure(result);
        return;
      }
      setFailure(null);
      setOpen(false);
      toast("Cobro anulado");
    });
  }

  return (
    <ConfirmDialog
      tone="destructive"
      trigger={
        openProp === undefined ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={triggerTestId}
          >
            {triggerLabel}
          </Button>
        ) : undefined
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
      {failure && <ActionError failure={failure} testId="payment-error" />}
    </ConfirmDialog>
  );
}
