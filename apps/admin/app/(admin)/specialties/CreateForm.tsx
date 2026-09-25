"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useActionState, useEffect, useRef } from "react";
import { createSpecialty, type SpecialtyFormState } from "./actions";

const initialState: SpecialtyFormState = undefined;

export function CreateForm() {
  const [state, formAction, pending] = useActionState(
    createSpecialty,
    initialState,
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
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Field
          label="Nueva especialidad"
          error={state && "error" in state ? state.error : undefined}
        >
          <Input
            name="name"
            required
            placeholder="Logopedia, Psicología…"
            data-testid="specialty-name-input"
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending} data-testid="specialty-submit">
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </form>
  );
}
