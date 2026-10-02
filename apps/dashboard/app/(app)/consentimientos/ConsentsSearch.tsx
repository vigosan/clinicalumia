"use client";

import { SearchInput } from "@clinicalumia/ui/search-input";
import { SegmentedControl } from "@clinicalumia/ui/segmented-control";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consentsListHref } from "@/lib/consents";

export function ConsentsSearch({
  defaultQuery,
  defaultPendingOnly,
}: {
  defaultQuery: string;
  defaultPendingOnly: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [pendingOnly, setPendingOnly] = useState(defaultPendingOnly);
  const lastHref = useRef(
    consentsListHref({
      q: defaultQuery,
      pendingOnly: defaultPendingOnly,
      page: 1,
    }),
  );

  useEffect(() => {
    const incoming = consentsListHref({
      q: defaultQuery,
      pendingOnly: defaultPendingOnly,
      page: 1,
    });
    if (incoming === lastHref.current) return;
    lastHref.current = incoming;
    setQuery(defaultQuery);
    setPendingOnly(defaultPendingOnly);
  }, [defaultQuery, defaultPendingOnly]);

  useEffect(() => {
    const href = consentsListHref({ q: query, pendingOnly, page: 1 });
    if (href === lastHref.current) return;
    const timeout = setTimeout(() => {
      lastHref.current = href;
      router.replace(href);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, pendingOnly, router]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <SearchInput
          aria-label="Buscar consentimientos"
          placeholder="Nombre o DNI/NIE"
          data-testid="consents-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <SegmentedControl
        aria-label="Mostrar consentimientos"
        value={pendingOnly ? "pending" : "all"}
        onValueChange={(value) => setPendingOnly(value === "pending")}
        options={[
          {
            value: "pending",
            label: "Pendientes",
            testId: "consents-pending-filter",
          },
          { value: "all", label: "Todos", testId: "consents-all-filter" },
        ]}
      />
    </div>
  );
}
