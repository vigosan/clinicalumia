"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { DatePicker } from "@clinicalumia/ui/date-picker";
import { Field } from "@clinicalumia/ui/field";
import { TimeSelect } from "@clinicalumia/ui/time-select";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { toastOnRedirect } from "@/lib/toast-on-redirect";
import { moveAppointment } from "../appointments/actions";
import { DurationField } from "../appointments/DurationField";

const moveAppointmentWithToast = toastOnRedirect(
  moveAppointment,
  "Cita cambiada",
);

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
    moveAppointmentWithToast,
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Fecha">
            <DatePicker
              name="date"
              data-testid="appointment-move-date"
              today={todayInMadrid()}
              defaultValue={initialDate}
              onValueChange={resetConfirmation}
            />
          </Field>
        </div>
        <Field label="Hora">
          <TimeSelect
            name="time"
            data-testid="appointment-move-time"
            defaultValue={initialTime}
            onValueChange={resetConfirmation}
          />
        </Field>
        <DurationField
          testId="appointment-move-duration"
          value={duration}
          onValueChange={(next) => {
            setDuration(next);
            resetConfirmation();
          }}
        />
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
            Guardar igualmente
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
        {pending ? "Guardando…" : "Guardar cambio"}
      </Button>
    </form>
  );
}
