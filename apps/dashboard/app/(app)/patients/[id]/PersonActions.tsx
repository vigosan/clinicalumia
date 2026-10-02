"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@clinicalumia/ui/dropdown-menu";
import { toast } from "@clinicalumia/ui/toast";
import { Archive, ArchiveRestore, Ellipsis, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { DrawerLink } from "../../url-drawer";
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
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(
    null,
  );

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
          <DrawerLink href={`/patients/${personId}?editar=1`} scroll={false}>
            Editar
          </DrawerLink>
        </Button>
        {isOwner && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                aria-label="Más acciones"
                data-testid="person-menu"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="person-archive"
                onSelect={() =>
                  isArchived ? handleArchiveToggle() : setConfirming("archive")
                }
              >
                {isArchived ? (
                  <ArchiveRestore aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
                {isArchived ? "Desarchivar" : "Archivar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="person-delete"
                className="text-danger-600 [&_svg]:text-danger-600"
                onSelect={() => setConfirming("delete")}
              >
                <Trash2 aria-hidden="true" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ConfirmDialog
          open={confirming === "archive"}
          onOpenChange={(open) => !open && setConfirming(null)}
          title="¿Archivar esta ficha?"
          description="Dejará de aparecer entre los pacientes activos. La encontrarás en «Archivados», desde donde podrás desarchivarla."
          confirmLabel="Archivar"
          onConfirm={handleArchiveToggle}
        />
        <ConfirmDialog
          open={confirming === "delete"}
          onOpenChange={(open) => !open && setConfirming(null)}
          title="¿Eliminar esta ficha?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          tone="destructive"
          onConfirm={handleDelete}
        />
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
