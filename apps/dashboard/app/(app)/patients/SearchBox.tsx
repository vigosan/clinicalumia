"use client";

import { SearchInput } from "@clinicalumia/ui/search-input";
import { SegmentedControl } from "@clinicalumia/ui/segmented-control";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { patientsListHref } from "@/lib/patients-list";

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
      router.replace(patientsListHref({ q: query, archived, page: 1 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, archived, router]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <SearchInput
          aria-label="Buscar pacientes"
          placeholder="Nombre, DNI, teléfono o email"
          data-testid="patients-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
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
