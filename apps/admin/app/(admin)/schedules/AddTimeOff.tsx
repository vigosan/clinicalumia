"use client";

import { Button } from "@clinicalumia/ui/button";
import { Drawer } from "@clinicalumia/ui/drawer";
import { useCallback, useState } from "react";
import { TimeOffForm } from "./TimeOffForm";

export function AddTimeOff({
  profileId,
  employeeName,
}: {
  profileId: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="secondary" data-testid="time-off-new">
          Añadir ausencia
        </Button>
      }
      title="Nueva ausencia"
      description={employeeName}
    >
      <TimeOffForm profileId={profileId} onDone={close} />
    </Drawer>
  );
}
