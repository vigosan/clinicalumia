"use client";

import { Drawer } from "@clinicalumia/ui/drawer";
import type { ReactNode } from "react";
import { showUrl, useUrlDrawer } from "../url-drawer";

export function PersonDrawer({
  param,
  closeHref,
  title,
  description,
  testId,
  children,
}: {
  param: string;
  closeHref: string;
  title: string;
  description: string;
  testId: string;
  children: ReactNode;
}) {
  const open = useUrlDrawer(param);

  function handleOpenChange(next: boolean) {
    if (next) return;
    showUrl(closeHref);
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
