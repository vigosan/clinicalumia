"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { PersonCombobox } from "@clinicalumia/ui/combobox";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { toast } from "@clinicalumia/ui/toast";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withAge } from "@/lib/person-search";
import type { Ward } from "@/lib/ward-label";
import {
  SelectedPerson,
  useSelectionFocus,
} from "../../appointments/PatientPicker";
import {
  addGuardian,
  type GuardianCandidate,
  searchGuardianCandidates,
} from "../actions";
import { RELATIONSHIP_OPTIONS } from "../relationship-options";

export function AddGuardian({ minorId }: { minorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GuardianCandidate | null>(null);
  const [relationship, setRelationship] =
    useState<Ward["relationship"]>("madre");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { containerRef, changeButtonRef, keepFocusRef } =
    useSelectionFocus(selected);

  function reset() {
    setOpen(false);
    setSelected(null);
    setIsPrimary(false);
    setError(null);
  }

  async function search(query: string) {
    const today = todayInMadrid();
    return (await searchGuardianCandidates(query, minorId)).map((row) =>
      withAge(row, today),
    );
  }

  function handleSave() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await addGuardian(
        minorId,
        selected.id,
        relationship,
        isPrimary,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      reset();
      toast("Tutor/a añadido/a");
    });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : reset())}
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="guardian-add"
        >
          Añadir tutor/a
        </Button>
      }
      title="Añadir tutor/a"
      description="Tutores"
    >
      <div ref={containerRef} className="flex flex-col gap-4">
        {selected ? (
          <SelectedPerson
            label="Tutor/a"
            person={selected}
            changeButtonRef={changeButtonRef}
            data-testid="guardian-selected"
            changeTestId="guardian-change"
            onChange={() => {
              keepFocusRef.current = true;
              setSelected(null);
            }}
          />
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
              onSelect: () =>
                router.push(`/patients/new?guardianOf=${minorId}`),
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
        {error && (
          <p
            role="alert"
            data-testid="guardian-error"
            className="text-[13px] text-danger-600"
          >
            {error}
          </p>
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
    </Drawer>
  );
}
