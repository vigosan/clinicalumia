"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
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

  return (
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
        <DatePicker name="starts_on" today={todayInMadrid()} required />
      </Field>
      <Field label="Hasta">
        <DatePicker name="ends_on" today={todayInMadrid()} required />
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
  );
}
