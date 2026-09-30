"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { Textarea } from "@clinicalumia/ui/textarea";
import { useRef, useState, useTransition } from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { voidPayment } from "../payments/actions";

export function VoidPaymentDialog({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleConfirm() {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await voidPayment(paymentId, reason);
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
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="payment-void"
        >
          Anular cobro
        </Button>
      }
      title="¿Anular este cobro?"
      description="El cobro quedará anulado en el historial y se podrá volver a cobrar."
      confirmLabel={pending ? "Anulando…" : "Anular cobro"}
      cancelLabel="Volver"
      confirmTestId="payment-void-confirm"
      open={open}
      onOpenChange={setOpen}
      closeOnConfirm={false}
      confirmDisabled={pending}
      onConfirm={handleConfirm}
    >
      <Field label="Motivo">
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
