"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { useOptimistic, useState, useTransition } from "react";
import { deleteSpecialty } from "./actions";
import { EditSpecialty } from "./EditSpecialty";

type Specialty = {
  id: string;
  name: string;
  slug: string;
};

export function SpecialtyRow({ specialty }: { specialty: Specialty }) {
  const [pending, startTransition] = useTransition();
  const [deleted, setOptimisticDeleted] = useOptimistic(false);
  const [error, setError] = useState<string | null>(null);

  if (deleted) return null;

  return (
    <li
      data-testid="specialty-row"
      className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"
    >
      <div className="flex-1">
        <p className="text-[15px] font-medium text-ink-900">{specialty.name}</p>
        <p className="text-xs text-ink-800">{specialty.slug}</p>
      </div>

      <EditSpecialty specialty={specialty} />

      <ConfirmDialog
        tone="destructive"
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
            setOptimisticDeleted(true);
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
