"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { useState, useTransition } from "react";
import { updateMember } from "./actions";

type Specialty = { id: string; name: string };

type Member = {
  id: string;
  full_name: string;
  specialty_id: string | null;
  license_number: string | null;
};

function EditForm({
  member,
  specialties,
  onDone,
}: {
  member: Member;
  specialties: Specialty[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updateMember(member.id, formData);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          onDone();
        })
      }
      className="flex flex-col gap-4"
    >
      <Field label="Nombre">
        <Input
          name="full_name"
          defaultValue={member.full_name}
          required
          autoFocus
        />
      </Field>
      <Field label="Especialidad">
        <Select
          name="specialty_id"
          defaultValue={member.specialty_id ?? ""}
          options={[
            { value: "", label: "Sin asignar" },
            ...specialties.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </Field>
      <Field label="Nº de colegiado" hint="Aparecerá en sus facturas.">
        <Input
          name="license_number"
          defaultValue={member.license_number ?? ""}
        />
      </Field>
      {error && (
        <p
          role="alert"
          data-testid="member-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function EditMember({
  member,
  specialties,
}: {
  member: Member;
  specialties: Specialty[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="member-edit"
        >
          Editar
        </Button>
      }
      title="Editar empleado"
      description={member.full_name}
    >
      <EditForm
        member={member}
        specialties={specialties}
        onDone={() => setOpen(false)}
      />
    </Drawer>
  );
}
