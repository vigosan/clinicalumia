"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useState, useTransition } from "react";
import { renameSpecialty } from "./actions";

type Specialty = { id: string; name: string };

function RenameForm({
  specialty,
  onDone,
}: {
  specialty: Specialty;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await renameSpecialty(specialty.id, formData);
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
          type="text"
          name="name"
          defaultValue={specialty.name}
          required
          autoFocus
          data-testid="specialty-rename-input"
        />
      </Field>
      {error && (
        <p
          role="alert"
          data-testid="specialty-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} data-testid="specialty-save">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function EditSpecialty({ specialty }: { specialty: Specialty }) {
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
          data-testid="specialty-edit"
        >
          Editar
        </Button>
      }
      title="Editar especialidad"
      description={specialty.name}
    >
      <RenameForm specialty={specialty} onDone={() => setOpen(false)} />
    </Drawer>
  );
}
