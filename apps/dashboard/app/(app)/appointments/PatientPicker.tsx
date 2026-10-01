"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { PersonCombobox } from "@clinicalumia/ui/combobox";
import { Field } from "@clinicalumia/ui/field";
import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef } from "react";
import { withAge } from "@/lib/person-search";
import { type PatientOption, searchPatients } from "./actions";

export type { PatientOption };

export function useSelectionFocus(selected: unknown) {
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

  return { containerRef, changeButtonRef, keepFocusRef };
}

export function SelectedPerson({
  label,
  person,
  changeButtonRef,
  onChange,
  "data-testid": testId,
  changeTestId,
}: {
  label: string;
  person: { first_name: string; last_name: string };
  changeButtonRef: RefObject<HTMLButtonElement | null>;
  onChange: () => void;
  "data-testid": string;
  changeTestId?: string;
}) {
  return (
    <Field label={label}>
      <div
        data-testid={testId}
        className="flex h-11 items-center justify-between gap-3 rounded-field border border-line-field bg-white px-3.5 text-[15px] text-ink-900"
      >
        <span>
          {person.first_name} {person.last_name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          ref={changeButtonRef}
          data-testid={changeTestId}
          onClick={onChange}
        >
          Cambiar
        </Button>
      </div>
    </Field>
  );
}

export function PatientPicker({
  selected,
  onSelect,
  onClear,
  returnTo,
  hideNewPerson = false,
}: {
  selected: PatientOption | null;
  onSelect: (patient: PatientOption) => void;
  onClear: () => void;
  returnTo?: string;
  hideNewPerson?: boolean;
}) {
  const router = useRouter();
  const { containerRef, changeButtonRef, keepFocusRef } =
    useSelectionFocus(selected);

  async function search(query: string) {
    const today = todayInMadrid();
    return (await searchPatients(query)).map((row) => withAge(row, today));
  }

  return (
    <div ref={containerRef}>
      {selected ? (
        <SelectedPerson
          label="Paciente"
          person={selected}
          changeButtonRef={changeButtonRef}
          data-testid="patient-selected"
          onChange={() => {
            keepFocusRef.current = true;
            onClear();
          }}
        />
      ) : (
        <PersonCombobox
          label="Paciente"
          placeholder="Nombre, DNI, teléfono o email"
          search={search}
          onSelect={(patient) => {
            keepFocusRef.current = true;
            onSelect({
              id: patient.id,
              first_name: patient.first_name,
              last_name: patient.last_name,
            });
          }}
          emptyText="No hay pacientes con esos datos."
          action={
            hideNewPerson
              ? undefined
              : {
                  label: "Nuevo paciente",
                  onSelect: () =>
                    router.push(
                      returnTo
                        ? `/patients/new?returnTo=${encodeURIComponent(returnTo)}`
                        : "/patients/new",
                    ),
                }
          }
          data-testid="patient-search"
          optionTestId="patient-option"
        />
      )}
    </div>
  );
}
