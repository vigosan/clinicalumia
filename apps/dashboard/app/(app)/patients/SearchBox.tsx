"use client";

import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { SegmentedControl } from "@clinicalumia/ui/segmented-control";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SearchBox({
  defaultQuery,
  defaultArchived,
}: {
  defaultQuery: string;
  defaultArchived: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [archived, setArchived] = useState(defaultArchived);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (archived) params.set("archived", "1");
      const search = params.toString();
      router.replace(search ? `/patients?${search}` : "/patients");
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, archived, router]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <Field label="Buscar por nombre, DNI, teléfono o email">
          <Input
            data-testid="patients-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>
      <SegmentedControl
        aria-label="Mostrar fichas"
        value={archived ? "archived" : "active"}
        onValueChange={(value) => setArchived(value === "archived")}
        options={[
          { value: "active", label: "Activos", testId: "patients-active" },
          {
            value: "archived",
            label: "Archivados",
            testId: "patients-archived",
          },
        ]}
      />
    </div>
  );
}
