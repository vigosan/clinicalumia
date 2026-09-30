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
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      router.replace(consentsListHref({ q: query, pendingOnly, page: 1 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, pendingOnly, router]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <Field label="Buscar por nombre o DNI">
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
