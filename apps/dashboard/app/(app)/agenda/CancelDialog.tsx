"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { Textarea } from "@clinicalumia/ui/textarea";
import { AlertDialog } from "radix-ui";
import { useRef, useState, useTransition } from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { cancelAppointment } from "../appointments/actions";

export function CancelDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState<"patient" | "clinic">("patient");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleConfirm() {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await cancelAppointment(appointmentId, by, reason);
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
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button
          type="button"
          variant="danger"
          size="sm"
          data-testid="appointment-cancel"
        >
          Cancelar cita
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-surface p-6">
          <AlertDialog.Title className="text-xl font-bold text-ink-900">
            ¿Cancelar esta cita?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-[15px] text-ink-800">
            Esta acción no se puede deshacer.
          </AlertDialog.Description>
          <Field label="Cancelada por">
            <Select
              data-testid="cancel-by"
              value={by}
              onChange={(event) =>
                setBy(event.target.value as "patient" | "clinic")
              }
            >
              <option value="patient">El paciente</option>
              <option value="clinic">La clínica</option>
            </Select>
          </Field>
          <Field label="Motivo">
            <Textarea
              data-testid="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          {error && (
            <p
              role="alert"
              data-testid="appointment-action-error"
              className="text-[13px] text-danger-600"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="sm">
                Volver
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              data-testid="cancel-confirm"
              onClick={handleConfirm}
            >
              Cancelar cita
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
