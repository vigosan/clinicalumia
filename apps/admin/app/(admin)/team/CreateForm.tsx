"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { useActionState, useEffect, useRef } from "react";
import { type CreateMemberState, createMember } from "./actions";

type SpecialtyOption = { id: string; name: string };

const initialState: CreateMemberState = undefined;

export function CreateForm({
  specialties,
}: {
  specialties: SpecialtyOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createMember,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Invitar a un empleado</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email">
          <Input
            type="email"
            name="email"
            required
            placeholder="nombre@clinicalumia.es"
          />
        </Field>
        <Field label="Nombre completo">
          <Input name="full_name" required />
        </Field>
        <Field label="Especialidad">
          <Select name="specialty_id" defaultValue="">
            <option value="">Sin asignar</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </Button>
        {state && "error" in state && (
          <p role="alert" className="text-[13px] text-danger-600">
            {state.error}
          </p>
        )}
        {state && "ok" in state && state.ok && (
          <p role="status" className="text-[13px] text-sage-900">
            Invitación enviada por email.
          </p>
        )}
      </div>
    </form>
  );
}
