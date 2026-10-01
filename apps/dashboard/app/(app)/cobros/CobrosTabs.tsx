"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@clinicalumia/ui/tabs";
import { type ReactNode, useState } from "react";

export type CobrosTab = "cobrados" | "pendientes";

export function CobrosTabs({
  initialTab,
  pendingLabel,
  cobrados,
  pendientes,
}: {
  initialTab: CobrosTab;
  pendingLabel: string;
  cobrados: ReactNode;
  pendientes: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);

  function handleChange(value: string) {
    const next = value === "pendientes" ? "pendientes" : "cobrados";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "pendientes") url.searchParams.set("tab", next);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={handleChange}>
      <TabsList aria-label="Cobros">
        <TabsTrigger value="cobrados" data-testid="payments-tab-cobrados">
          Cobrados
        </TabsTrigger>
        <TabsTrigger value="pendientes" data-testid="payments-tab-pendientes">
          {pendingLabel}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="cobrados" className="flex flex-col gap-6">
        {cobrados}
      </TabsContent>
      <TabsContent value="pendientes" className="flex flex-col gap-6">
        {pendientes}
      </TabsContent>
    </Tabs>
  );
}
