"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { toast } from "@clinicalumia/ui/toast";
import { useActionState, useCallback, useEffect, useState } from "react";
import { type CreateMemberState, createMember } from "./actions";

type SpecialtyOption = { id: string; name: string };

const initialState: CreateMemberState = undefined;

function InviteForm({
  specialties,
  onDone,
}: {
  specialties: SpecialtyOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createMember,
    initialState,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      toast("Invitación enviada por email");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email">
        <Input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="nombre@clinicalumia.es"
        />
      </Field>
      <Field label="Nombre completo">
        <Input name="full_name" required />
      </Field>
      <Field label="Especialidad">
        <Select
          name="specialty_id"
          defaultValue=""
          options={[
            { value: "", label: "Sin asignar" },
            ...specialties.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </Field>
      <Field
        label="Nº de colegiado"
        hint="Opcional. Aparecerá en sus facturas."
      >
        <Input name="license_number" />
      </Field>
      {state && "error" in state && (
        <p role="alert" className="text-[13px] text-danger-600">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Invitando…" : "Invitar"}
      </Button>
    </form>
  );
}

export function InviteMember({
  specialties,
}: {
  specialties: SpecialtyOption[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" data-testid="member-invite">
          Invitar a un empleado
        </Button>
      }
      title="Invitar a un empleado"
      description="Recibirá un email para crear su contraseña."
    >
      <InviteForm specialties={specialties} onDone={close} />
    </Drawer>
  );
}
