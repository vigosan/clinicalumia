"use client";

import { Button } from "@clinicalumia/ui/button";
import { useCallback, useState } from "react";
import { ClosureDrawer } from "./ClosureDrawer";

export function AddClosure({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <ClosureDrawer
      trigger={
        <Button type="button" variant="secondary" data-testid="closure-new">
          Añadir día de cierre
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      today={today}
      onDone={close}
    />
  );
}
