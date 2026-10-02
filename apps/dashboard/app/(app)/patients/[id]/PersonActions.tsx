"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { toast } from "@clinicalumia/ui/toast";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deletePerson,
  setArchived,
  type UpcomingAppointment,
} from "../actions";

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
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await setArchived(personId, !isArchived);
      if ("error" in result) {
        setError(result.error);
        setUpcoming(result.appointments ?? []);
        return;
      }
      setError(null);
      setUpcoming([]);
      toast(isArchived ? "Ficha desarchivada" : "Ficha archivada");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePerson(personId);
      if ("error" in result) {
        setError(result.error);
        setUpcoming([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/patients/${personId}/edit`}>Editar</Link>
        </Button>
        {isOwner &&
          (isArchived ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              data-testid="person-archive"
              onClick={handleArchiveToggle}
            >
              Desarchivar
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
              title="¿Archivar esta ficha?"
              description="Dejará de aparecer entre los pacientes activos. La encontrarás en «Archivados», desde donde podrás desarchivarla."
              confirmLabel="Archivar"
              onConfirm={handleArchiveToggle}
            />
          ))}
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
            title="¿Eliminar esta ficha?"
            description="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            tone="destructive"
            onConfirm={handleDelete}
          />
        )}
      </div>
      {error && upcoming.length > 0 && (
        <Alert data-testid="person-archive-blocked" title={error}>
          <ul className="mt-1 flex flex-col gap-1">
            {upcoming.map((appointment) => (
              <li
                key={appointment.id}
                data-testid="person-archive-blocked-item"
              >
                {appointment.when} · {appointment.professional}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {error && upcoming.length === 0 && (
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
