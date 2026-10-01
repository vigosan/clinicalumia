"use client";

import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgendaColumn } from "./load";

export function SeeAlso({
  date,
  view,
  candidates,
  selectedIds,
}: {
  date: string;
  view: string;
  candidates: AgendaColumn[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(selectedIds);

  if (candidates.length === 0) return null;

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];
    setSelected(next);
    const search = new URLSearchParams({ date, view });
    if (next.length > 0) search.set("with", next.join(","));
    router.push(`/?${search.toString()}`);
  }

  return (
    <div
      data-testid="see-also"
      className="flex flex-wrap items-center gap-4 text-sm"
    >
      <span className="font-medium text-ink-900">Ver también la agenda de</span>
      {candidates.map((candidate) => (
        <div key={candidate.id} data-testid="see-also-option">
          <CheckboxField
            label={candidate.fullName}
            checked={selected.includes(candidate.id)}
            onChange={() => toggle(candidate.id)}
          />
        </div>
      ))}
    </div>
  );
}
