"use client";

import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <Field label="Buscar por nombre o DNI/NIE">
          <Input
            data-testid="consents-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>
      <CheckboxField
        label="Solo pendientes"
        data-testid="consents-pending-filter"
        checked={pendingOnly}
        onChange={(event) => setPendingOnly(event.target.checked)}
      />
    </div>
  );
}
