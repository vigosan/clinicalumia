"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Ward } from "@/lib/ward-label";
import {
  addGuardian,
  type GuardianCandidate,
  searchGuardianCandidates,
} from "../actions";
import { RELATIONSHIP_OPTIONS } from "../relationship-options";

export function AddGuardian({
  minorId,
  onError,
}: {
  minorId: string;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GuardianCandidate[]>([]);
  const [selected, setSelected] = useState<GuardianCandidate | null>(null);
  const [relationship, setRelationship] =
    useState<Ward["relationship"]>("madre");
  const [isPrimary, setIsPrimary] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setCandidates([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void searchGuardianCandidates(value).then(setCandidates);
    }, 300);
  }

  function handleSave() {
    if (!selected) return;
    onError(null);
    startTransition(async () => {
      const result = await addGuardian(
        minorId,
        selected.id,
        relationship,
        isPrimary,
      );
      if ("error" in result) {
        onError(result.error);
        return;
      }
      setOpen(false);
      setQuery("");
      setCandidates([]);
      setSelected(null);
      setIsPrimary(false);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="guardian-add"
        onClick={() => setOpen(true)}
      >
        Añadir tutor
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Buscar persona">
        <Input
          data-testid="guardian-search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </Field>
      {candidates.length > 0 && !selected && (
        <ul className="flex flex-col gap-1">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="guardian-option"
                onClick={() => setSelected(candidate)}
              >
                {candidate.first_name} {candidate.last_name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="ghost" size="sm">
        <Link href={`/patients/new?guardianOf=${minorId}`}>Nueva persona</Link>
      </Button>
      {selected && (
        <>
          <p className="text-[15px] text-ink-900">
            {selected.first_name} {selected.last_name}
          </p>
          <Field label="Parentesco">
            <Select
              data-testid="guardian-relationship"
              value={relationship}
              onChange={(event) =>
                setRelationship(event.target.value as Ward["relationship"])
              }
            >
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <CheckboxField
            label="Tutor/a principal"
            data-testid="guardian-primary"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="guardian-save"
              onClick={handleSave}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
