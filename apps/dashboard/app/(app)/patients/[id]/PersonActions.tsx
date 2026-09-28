"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePerson, setArchived } from "../actions";

export function PersonActions({
  personId,
  isArchived,
  isOwner,
}: {
  personId: string;
  isArchived: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await setArchived(personId, !isArchived);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePerson(personId);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/patients/${personId}/edit`}>Editar</Link>
        </Button>
        {isArchived ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            data-testid="person-archive"
            onClick={handleArchiveToggle}
          >
            Recuperar
          </Button>
        ) : (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                data-testid="person-archive"
              >
                Archivar
              </Button>
            }
            title="¿Archivar a esta persona?"
            description="Dejará de aparecer en el listado. Puedes recuperarla cuando quieras."
            confirmLabel="Archivar"
            onConfirm={handleArchiveToggle}
          />
        )}
        {isOwner && (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={pending}
                data-testid="person-delete"
              >
                Eliminar
              </Button>
            }
            title="¿Eliminar a esta persona?"
            description="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            onConfirm={handleDelete}
          />
        )}
      </div>
      {error && (
        <p
          role="alert"
          data-testid="person-action-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
