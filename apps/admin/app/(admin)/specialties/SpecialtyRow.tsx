"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Input } from "@clinicalumia/ui/input";
import { useState, useTransition } from "react";
import { deleteSpecialty, renameSpecialty } from "./actions";

type Specialty = {
  id: string;
  name: string;
  slug: string;
};

export function SpecialtyRow({ specialty }: { specialty: Specialty }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <li
        data-testid="specialty-row"
        className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"
      >
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await renameSpecialty(specialty.id, formData);
              if ("error" in result) {
                setError(result.error);
                return;
              }
              setError(null);
              setEditing(false);
            })
          }
          className="flex flex-1 items-center gap-3"
        >
          <Input
            type="text"
            name="name"
            defaultValue={specialty.name}
            required
            autoFocus
            data-testid="specialty-rename-input"
            className="flex-1"
            aria-label="Nombre de la especialidad"
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending}
            data-testid="specialty-save"
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </form>
        {error && (
          <p
            role="alert"
            data-testid="specialty-error"
            className="w-full text-[13px] text-danger-600"
          >
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li
      data-testid="specialty-row"
      className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"
    >
      <div className="flex-1">
        <p className="text-[15px] font-medium text-ink-900">{specialty.name}</p>
        <p className="text-xs text-ink-800">{specialty.slug}</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="specialty-edit"
        onClick={() => setEditing(true)}
      >
        Editar
      </Button>

      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            data-testid="specialty-delete"
          >
            Eliminar
          </Button>
        }
        title={`¿Eliminar «${specialty.name}»?`}
        description="Los empleados que la tengan asignada se quedarán sin especialidad."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteSpecialty(specialty.id);
            setError("error" in result ? result.error : null);
          })
        }
      />
      {error && (
        <p
          role="alert"
          data-testid="specialty-error"
          className="w-full text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </li>
  );
}
