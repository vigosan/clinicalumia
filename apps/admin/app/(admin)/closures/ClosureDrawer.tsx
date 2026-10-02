"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Drawer } from "@clinicalumia/ui/drawer";
import { type ReactElement, useState, useTransition } from "react";
import { type Closure, closureLabel } from "@/lib/closures";
import { deleteClosure } from "./actions";
import { ClosureForm } from "./ClosureForm";

function DeleteClosure({
  closure,
  onDone,
}: {
  closure: Closure;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 border-line border-t pt-4">
      <ConfirmDialog
        tone="destructive"
        trigger={
          <Button
            type="button"
            variant="danger"
            data-testid="closure-delete"
            disabled={pending}
          >
            Eliminar cierre
          </Button>
        }
        title="¿Eliminar este cierre?"
        description="Esos días se podrá volver a reservar desde la web."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteClosure(closure.id);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            onDone();
          })
        }
      />
      {error && (
        <p role="alert" className="text-[13px] text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function ClosureDrawer({
  trigger,
  open,
  onOpenChange,
  closure,
  day,
  today,
  onDone,
}: {
  trigger?: ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closure?: Closure;
  day?: string;
  today: string;
  onDone: () => void;
}) {
  return (
    <Drawer
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={closure ? "Editar día de cierre" : "Nuevo día de cierre"}
      description={closure ? closureLabel(closure) : "Días de cierre"}
    >
      <ClosureForm
        key={closure?.id ?? day}
        today={today}
        day={day}
        closure={closure}
        onDone={onDone}
      />
      {closure && <DeleteClosure closure={closure} onDone={onDone} />}
    </Drawer>
  );
}
