"use client";

import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { deleteTimeOff } from "./actions";

type TimeOff = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid" }).format(
    new Date(value),
  );
}

export function TimeOffRow({ timeOff }: { timeOff: TimeOff }) {
  const [pending, startTransition] = useTransition();
  const [deleted, setOptimisticDeleted] = useOptimistic(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${formatDate(timeOff.starts_at)} – ${formatDate(timeOff.ends_at)}${timeOff.reason ? ` · ${timeOff.reason}` : ""}`;

  if (deleted) return null;

  return (
    <li
      data-testid="timeoff-row"
      className="flex flex-wrap items-center justify-between gap-3 py-2 pr-2 pl-4 [&+&]:border-separator [&+&]:border-t"
    >
      <span className="min-w-0 flex-1 text-[15px] text-ink-900">{label}</span>
      <ConfirmDialog
        tone="destructive"
        trigger={
          <button
            type="button"
            data-testid="timeoff-delete"
            aria-label={`Eliminar la ausencia del ${label}`}
            disabled={pending}
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-tertiary transition-colors duration-150 hover:bg-danger-100 hover:text-danger-600 focus-visible:outline-2 focus-visible:outline-sage-800 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        }
        title="¿Eliminar esta ausencia?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
            setOptimisticDeleted(true);
            const result = await deleteTimeOff(timeOff.id);
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
