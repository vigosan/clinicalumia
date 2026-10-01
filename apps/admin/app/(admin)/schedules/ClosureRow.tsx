"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { useState, useTransition } from "react";
import { type Closure, closureLabel } from "@/lib/closures";
import { deleteClosure } from "./actions";

export function ClosureRow({ closure }: { closure: Closure }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li
      data-testid="closure-row"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"
    >
      <span className="text-[15px] text-ink-900">{closureLabel(closure)}</span>
      <ConfirmDialog
        tone="destructive"
        trigger={
          <Button
            type="button"
            variant="danger"
            size="sm"
            data-testid="closure-delete"
            disabled={pending}
          >
            Eliminar
          </Button>
        }
        title="¿Eliminar este cierre?"
        description="Esos días se podrá volver a reservar desde la web."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteClosure(closure.id);
            if ("error" in result) setError(result.error);
            else setError(null);
          })
        }
      />
      {error && (
        <p role="alert" className="w-full text-[13px] text-danger-600">
          {error}
        </p>
      )}
    </li>
  );
}
