"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { useCallback, useState } from "react";
import { ClosureForm } from "./ClosureForm";

export function AddClosure({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="secondary" data-testid="closure-new">
          Añadir día de cierre
        </Button>
      }
      title="Nuevo día de cierre"
      description="Días de cierre"
    >
      <ClosureForm today={today} onDone={close} />
    </Drawer>
  );
}
