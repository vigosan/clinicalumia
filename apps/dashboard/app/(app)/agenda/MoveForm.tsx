"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { moveAppointment } from "../appointments/actions";

export function MoveForm({
  appointmentId,
  patientId,
  serviceId,
  professionalId,
  durationMinutes,
  initialDate,
  initialTime,
}: {
  appointmentId: string;
  patientId: string;
  serviceId: string;
  professionalId: string;
  durationMinutes: number;
  initialDate: string;
  initialTime: string;
}) {
  const [state, formAction, pending] = useActionState(
    moveAppointment,
    undefined,
  );
  const [duration, setDuration] = useState(String(durationMinutes));
  const formRef = useRef<HTMLFormElement>(null);
  const submitGateRef = useRef(createSubmitGate());
  const dismissedStateRef = useRef(state);

  useEffect(() => {
    if (!pending) submitGateRef.current.finish();
  }, [pending]);

  const warnings =
    state && "warnings" in state && dismissedStateRef.current !== state
      ? state.warnings
      : [];
  const error = state && "error" in state ? state.error : null;

  function resetConfirmation() {
    dismissedStateRef.current = state;
  }

  function submit(formData: FormData) {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(() => formAction(formData));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  }

  function handleConfirm() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("confirm", "1");
    submit(formData);
  }

  return (
    <form
      ref={formRef}
      data-testid="appointment-move-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="professional_id" value={professionalId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Fecha">
          <Input
            name="date"
            type="date"
            data-testid="appointment-move-date"
            defaultValue={initialDate}
            onChange={resetConfirmation}
          />
        </Field>
        <Field label="Hora">
          <Input
            name="time"
            type="time"
            data-testid="appointment-move-time"
            defaultValue={initialTime}
            onChange={resetConfirmation}
          />
        </Field>
        <Field label="Duración (minutos)">
          <Input
            name="duration_minutes"
            type="number"
            step={5}
            min={5}
            max={480}
            data-testid="appointment-move-duration"
            value={duration}
            onChange={(event) => {
              setDuration(event.target.value);
              resetConfirmation();
            }}
          />
        </Field>
      </div>

      {warnings.length > 0 && (
        <div
          role="alert"
          data-testid="appointment-warnings"
          className="flex flex-col gap-2 rounded-field border border-line bg-cream-200 p-3 text-[13px] text-ink-900"
        >
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            data-testid="appointment-confirm"
            onClick={handleConfirm}
          >
            Mover igualmente
          </Button>
        </div>
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

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={pending}
        data-testid="appointment-move"
      >
        {pending ? "Moviendo…" : "Mover"}
      </Button>
    </form>
  );
}
