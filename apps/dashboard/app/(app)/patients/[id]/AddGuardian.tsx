"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { PersonCombobox } from "@clinicalumia/ui/combobox";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { toast } from "@clinicalumia/ui/toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { withAge } from "@/lib/person-search";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GuardianCandidate | null>(null);
  const [relationship, setRelationship] =
    useState<Ward["relationship"]>("madre");
  const [isPrimary, setIsPrimary] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const keepFocusRef = useRef(false);

  useEffect(() => {
    if (!keepFocusRef.current) return;
    keepFocusRef.current = false;
    if (selected) {
      changeButtonRef.current?.focus();
    } else {
      containerRef.current
        ?.querySelector<HTMLInputElement>('[role="combobox"]')
        ?.focus();
    }
  }, [selected]);

  function reset() {
    setOpen(false);
    setSelected(null);
    setIsPrimary(false);
  }

  async function search(query: string) {
    const today = todayInMadrid();
    return (await searchGuardianCandidates(query, minorId)).map((row) =>
      withAge(row, today),
    );
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
      reset();
      toast("Tutor/a añadido/a");
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
        Añadir tutor/a
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {selected ? (
        <Field label="Tutor/a">
          <div
            data-testid="guardian-selected"
            className="flex h-11 items-center justify-between gap-3 rounded-field border border-line-field bg-white px-3.5 text-[15px] text-ink-900"
          >
            <span>
              {selected.first_name} {selected.last_name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              ref={changeButtonRef}
              data-testid="guardian-change"
              onClick={() => {
                keepFocusRef.current = true;
                setSelected(null);
              }}
            >
              Cambiar
            </Button>
          </div>
        </Field>
      ) : (
        <PersonCombobox
          label="Buscar tutor/a existente"
          placeholder="Nombre, DNI, teléfono o email"
          search={search}
          onSelect={(candidate) => {
            keepFocusRef.current = true;
            setSelected(candidate);
          }}
          emptyText="No hay ninguna ficha con esos datos."
          action={{
            label: "Nuevo tutor/a",
            onSelect: () => router.push(`/patients/new?guardianOf=${minorId}`),
          }}
          data-testid="guardian-search"
          optionTestId="guardian-option"
        />
      )}
      {selected && (
        <>
          <Field label="Parentesco">
            <Select
              data-testid="guardian-relationship"
              value={relationship}
              onValueChange={(value) =>
                setRelationship(value as Ward["relationship"])
              }
              options={RELATIONSHIP_OPTIONS}
            />
          </Field>
          <CheckboxField
            label="Tutor/a principal"
            data-testid="guardian-primary"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          <Button
            type="button"
            size="sm"
            disabled={pending}
            data-testid="guardian-save"
            onClick={handleSave}
          >
            {pending ? "Guardando…" : "Añadir tutor/a"}
          </Button>
        </>
      )}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="guardian-close"
          onClick={reset}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
