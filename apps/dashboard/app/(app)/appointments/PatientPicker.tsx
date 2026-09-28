"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type PatientOption, searchPatients } from "./actions";

export type { PatientOption };

export function PatientPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: PatientOption | null;
  onSelect: (patient: PatientOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearched(false);
    setSearchFailed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(() => {
      void searchPatients(value)
        .then((found) => {
          if (searchSeqRef.current !== seq) return;
          setResults(found);
          setSearched(true);
        })
        .catch(() => {
          if (searchSeqRef.current !== seq) return;
          setResults([]);
          setSearchFailed(true);
          setSearched(true);
        });
    }, 300);
  }

  if (selected) {
    return (
      <Field label="Paciente">
        <div
          data-testid="patient-selected"
          className="flex h-11 items-center justify-between gap-3 rounded-field border border-line-field bg-white px-3.5 text-[15px] text-ink-900"
        >
          <span>
            {selected.first_name} {selected.last_name}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Cambiar
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Paciente">
        <Input
          data-testid="patient-search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </Field>
      {searchFailed && (
        <p
          role="alert"
          data-testid="patient-search-error"
          className="text-[13px] text-danger-600"
        >
          No se ha podido buscar. Inténtalo de nuevo.
        </p>
      )}
      {!searchFailed && results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((option) => (
            <li key={option.id}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="patient-option"
                onClick={() => onSelect(option)}
              >
                {option.first_name} {option.last_name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!searchFailed && searched && results.length === 0 && (
        <p className="text-sm text-ink-800" data-testid="patient-search-empty">
          No hay nadie con esos datos.
        </p>
      )}
      <Button asChild variant="ghost" size="sm">
        <Link href="/patients/new">Nueva persona</Link>
      </Button>
    </div>
  );
}
