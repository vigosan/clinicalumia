"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);

  return (
    <li
      data-testid="timeoff-row"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"
    >
      <span className="text-[15px] text-ink-900">
        {formatDate(timeOff.starts_at)} – {formatDate(timeOff.ends_at)}
        {timeOff.reason ? ` · ${timeOff.reason}` : ""}
      </span>
      <ConfirmDialog
        trigger={
          <Button type="button" variant="danger" size="sm" disabled={pending}>
            Eliminar
          </Button>
        }
        title="¿Eliminar esta ausencia?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
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
