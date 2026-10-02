"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useActionState, useEffect, useState } from "react";
import { createSpecialty, type SpecialtyFormState } from "./actions";

const initialState: SpecialtyFormState = undefined;

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    createSpecialty,
    initialState,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nombre"
        error={state && "error" in state ? state.error : undefined}
      >
        <Input
          name="name"
          required
          autoFocus
          placeholder="Logopedia, Psicología…"
          data-testid="specialty-name-input"
        />
      </Field>
      <Button type="submit" disabled={pending} data-testid="specialty-submit">
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </form>
  );
}

export function NewSpecialty() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" data-testid="specialty-new">
          Nueva especialidad
        </Button>
      }
      title="Nueva especialidad"
      description="Especialidades"
    >
      <CreateForm onDone={() => setOpen(false)} />
    </Drawer>
  );
}
