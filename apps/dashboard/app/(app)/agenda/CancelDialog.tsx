"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { RadioCards } from "@clinicalumia/ui/radio-cards";
import { Textarea } from "@clinicalumia/ui/textarea";
import { toast } from "@clinicalumia/ui/toast";
import { useRef, useState, useTransition } from "react";
import { NOTICE_FAILED } from "@/lib/notice-toast";
import { createSubmitGate } from "@/lib/submit-gate";
import { cancelAppointment } from "../appointments/actions";

export function CancelDialog({
  appointmentId,
  invoiced,
  canNotify,
}: {
  appointmentId: string;
  invoiced: boolean;
  canNotify: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState<"patient" | "clinic">("patient");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleConfirm() {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await cancelAppointment(
        appointmentId,
        by,
        reason,
        canNotify && notify,
      );
      submitGateRef.current.finish();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpen(false);
      toast(
        result.noticeFailed
          ? `Cita cancelada. ${NOTICE_FAILED}`
          : "Cita cancelada",
      );
    });
  }

  return (
    <ConfirmDialog
      tone="destructive"
      trigger={
        <Button
          type="button"
          variant="danger"
          size="sm"
          data-testid="appointment-cancel"
        >
          Cancelar cita
        </Button>
      }
      title="¿Cancelar esta cita?"
      description="Esta acción no se puede deshacer."
      confirmLabel={pending ? "Cancelando…" : "Cancelar cita"}
      cancelLabel="Volver"
      confirmTestId="cancel-confirm"
      open={open}
      onOpenChange={setOpen}
      closeOnConfirm={false}
      onConfirm={handleConfirm}
    >
      {invoiced && (
        <p
          role="alert"
          data-testid="cancel-invoiced-warning"
          className="text-[13px] text-ink-900"
        >
          Esta cita está cobrada y facturada. Si hay que devolver el importe,
          anula el cobro (se emitirá una rectificativa).
        </p>
      )}
      <RadioCards
        label="¿Quién cancela?"
        data-testid="cancel-by"
        value={by}
        onValueChange={(value) => setBy(value as "patient" | "clinic")}
        options={[
          {
            value: "patient",
            label: "El paciente",
            testId: "cancel-by-patient",
          },
          { value: "clinic", label: "La clínica", testId: "cancel-by-clinic" },
        ]}
      />
      <Field label="Motivo">
        <Textarea
          data-testid="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {canNotify && (
        <CheckboxField
          label="Avisar al paciente por email"
          data-testid="notify-patient"
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
        />
      )}
      {error && (
        <p
          role="alert"
          data-testid="appointment-action-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
