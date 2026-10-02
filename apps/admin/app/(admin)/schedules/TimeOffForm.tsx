"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { DatePicker } from "@clinicalumia/ui/date-picker";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { addTimeOff, type TimeOffState } from "./actions";

export function TimeOffForm({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState<TimeOffState, FormData>(
    addTimeOff,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  const affected = state && "ok" in state ? state.affected : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        data-testid="timeoff-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="profile_id" value={profileId} />
        <Field label="Desde">
          <DatePicker
            name="starts_on"
            data-testid="timeoff-from"
            today={todayInMadrid()}
            required
          />
        </Field>
        <Field label="Hasta">
          <DatePicker
            name="ends_on"
            data-testid="timeoff-to"
            today={todayInMadrid()}
            required
          />
        </Field>
        <Field label="Motivo">
          <Input name="reason" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Añadir ausencia"}
        </Button>
        {state && "error" in state && (
          <p
            role="alert"
            data-testid="timeoff-error"
            className="text-[13px] text-danger-600"
          >
            {state.error}
          </p>
        )}
      </form>
      {affected === null && (
        <Alert tone="warning" data-testid="timeoff-affected">
          La ausencia se ha guardado, pero no se han podido comprobar sus citas
          de esos días. Revísalas en la agenda del panel.
        </Alert>
      )}
      {affected && affected.length > 0 && (
        <Alert
          tone="warning"
          data-testid="timeoff-affected"
          title={
            affected.length === 1
              ? "Tiene 1 cita en esos días"
              : `Tiene ${affected.length} citas en esos días`
          }
        >
          <p>
            No se ha cancelado ninguna. Muévelas a otra profesional o cancélalas
            desde el panel.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {affected.map((appointment) => (
              <li key={appointment.id} data-testid="timeoff-affected-item">
                {appointment.date} · {appointment.time} · {appointment.patient}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
