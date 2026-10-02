"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { useCallback, useState } from "react";
import { type Closure, closureLabel } from "@/lib/closures";
import { ClosureForm } from "./ClosureForm";

export function EditClosure({
  closure,
  today,
}: {
  closure: Closure;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="closure-edit"
        >
          Editar
        </Button>
      }
      title="Editar día de cierre"
      description={closureLabel(closure)}
    >
      <ClosureForm today={today} closure={closure} onDone={close} />
    </Drawer>
  );
}
