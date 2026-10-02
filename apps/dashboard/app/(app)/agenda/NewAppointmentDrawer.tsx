"use client";

import { Drawer } from "@clinicalumia/ui/drawer";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";
import { AppointmentForm } from "../appointments/AppointmentForm";

export function NewAppointmentDrawer({
  closeHref,
  form,
}: {
  closeHref: string;
  form: Omit<ComponentProps<typeof AppointmentForm>, "cancelHref">;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function handleOpenChange(next: boolean) {
    if (next) return;
    setOpen(false);
    router.push(closeHref, { scroll: false });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      data-testid="new-appointment-drawer"
      description="Elige paciente, servicio y hora."
      title="Nueva cita"
    >
      <AppointmentForm {...form} cancelHref={closeHref} />
    </Drawer>
  );
}
