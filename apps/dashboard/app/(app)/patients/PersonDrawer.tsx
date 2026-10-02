"use client";

import { Drawer } from "@clinicalumia/ui/drawer";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

export function PersonDrawer({
  closeHref,
  title,
  description,
  testId,
  children,
}: {
  closeHref: string;
  title: string;
  description: string;
  testId: string;
  children: ReactNode;
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
      title={title}
      description={description}
      data-testid={testId}
    >
      {children}
    </Drawer>
  );
}
