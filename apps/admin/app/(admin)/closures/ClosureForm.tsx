"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { DateRangePicker } from "@clinicalumia/ui/date-range-picker";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Closure } from "@/lib/closures";
import { addClosure, type ClosureState, updateClosure } from "./actions";

export function ClosureForm({
  today,
  closure,
  onDone,
}: {
  today: string;
  closure?: Closure;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ClosureState, FormData>(
    closure ? updateClosure : addClosure,
    undefined,
  );
  const [range, setRange] = useState(
    closure
      ? { from: closure.starts_on, to: closure.ends_on }
      : { from: today, to: today },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || !("ok" in state)) return;
    if (state.affected && state.affected.length === 0) {
      onDone();
      return;
    }
    if (closure) return;
    formRef.current?.reset();
    setRange({ from: today, to: today });
  }, [state, today, closure, onDone]);

  const affected = state && "ok" in state ? state.affected : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        data-testid="closure-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        {closure && <input type="hidden" name="id" value={closure.id} />}
        <input type="hidden" name="starts_on" value={range.from} />
        <input type="hidden" name="ends_on" value={range.to} />
        <Field label="Días">
          <DateRangePicker
            data-testid="closure-range"
            from={range.from}
            to={range.to}
            today={today}
            onChange={setRange}
          />
        </Field>
        <Field label="Motivo">
          <Input
            name="reason"
            maxLength={80}
            required
            defaultValue={closure?.reason}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : closure ? "Guardar" : "Añadir cierre"}
        </Button>
      </form>
      {state && "error" in state && (
        <p
          role="alert"
          data-testid="closure-error"
          className="text-[13px] text-danger-600"
        >
          {state.error}
        </p>
      )}
      {affected === null && (
        <Alert tone="warning" data-testid="closure-affected">
          El cierre se ha guardado, pero no se han podido comprobar las citas de
          esos días. Revísalas en la agenda del panel.
        </Alert>
      )}
      {affected && affected.length > 0 && (
        <Alert
          tone="warning"
          data-testid="closure-affected"
          title={
            affected.length === 1
              ? "Hay 1 cita en esos días"
              : `Hay ${affected.length} citas en esos días`
          }
        >
          <p>No se ha cancelado ninguna. Revísalas en la agenda del panel.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {affected.map((appointment) => (
              <li key={appointment.id} data-testid="closure-affected-item">
                {appointment.date} · {appointment.time} · {appointment.patient}{" "}
                · {appointment.professional}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
