"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { Textarea } from "@clinicalumia/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createDuplicateChecker,
  type DuplicateFields,
} from "@/lib/duplicate-checker";
import { createSubmitGate } from "@/lib/submit-gate";
import type { Ward } from "@/lib/ward-label";
import {
  addGuardian,
  checkDuplicates,
  type Duplicate,
  savePerson,
} from "./actions";
import { DuplicateWarning } from "./DuplicateWarning";
import { RELATIONSHIP_OPTIONS } from "./relationship-options";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  admin_notes: string;
  is_patient: boolean;
};

type GuardianOf = { id: string; minorName: string };

export function PersonForm({
  person,
  guardianOf,
  returnTo,
}: {
  person?: Person;
  guardianOf?: GuardianOf;
  returnTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(savePerson, undefined);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [checking, setChecking] = useState(false);
  const [useExistingError, setUseExistingError] = useState<string | null>(null);
  const [usingExisting, startUsingExisting] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkerRef = useRef(
    createDuplicateChecker<Duplicate>((fields) =>
      checkDuplicates({ ...fields, exclude: person?.id }),
    ),
  );
  const submitGateRef = useRef(createSubmitGate());

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!pending) submitGateRef.current.finish();
  }, [pending]);

  function currentFields(): DuplicateFields {
    const data = new FormData(formRef.current ?? undefined);
    return {
      tax_id: String(data.get("tax_id") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
    };
  }

  async function resolveDuplicates(): Promise<Duplicate[]> {
    const fields = currentFields();
    if (!fields.tax_id && !fields.email && !fields.phone) return [];
    const found = await checkerRef.current.ensureResolved(fields);
    setDuplicates(found);
    return found;
  }

  function handleDuplicateFieldBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void resolveDuplicates().catch(() => {});
    }, 300);
  }

  function handleUseExisting(id: string) {
    if (!guardianOf) {
      router.push(`/patients/${id}`);
      return;
    }
    setUseExistingError(null);
    const relationship = String(
      new FormData(formRef.current ?? undefined).get("relationship") ?? "otro",
    ) as Ward["relationship"];
    const isPrimary =
      new FormData(formRef.current ?? undefined).get("is_primary") === "on";
    startUsingExisting(async () => {
      const result = await addGuardian(
        guardianOf.id,
        id,
        relationship,
        isPrimary,
      );
      if ("error" in result) {
        setUseExistingError(result.error);
        return;
      }
      router.push(`/patients/${guardianOf.id}`);
    });
  }

  const cancelHref = person
    ? `/patients/${person.id}`
    : guardianOf
      ? `/patients/${guardianOf.id}`
      : "/patients";

  return (
    <form
      ref={formRef}
      data-testid="person-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitGateRef.current.tryStart()) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const formData = new FormData(event.currentTarget);
        setChecking(true);
        void (async () => {
          let found: Duplicate[] = [];
          try {
            found = await resolveDuplicates();
          } catch {
            found = [];
          } finally {
            setChecking(false);
          }
          if (found.length > 0) {
            submitGateRef.current.finish();
            return;
          }
          startTransition(() => formAction(formData));
        })();
      }}
      className="flex flex-col gap-5"
    >
      {person && <input type="hidden" name="id" value={person.id} />}
      {guardianOf && (
        <input type="hidden" name="guardian_of" value={guardianOf.id} />
      )}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <Input name="first_name" defaultValue={person?.first_name} required />
        </Field>
        <Field label="Apellidos">
          <Input name="last_name" defaultValue={person?.last_name} required />
        </Field>
        <Field label="Fecha de nacimiento">
          <Input
            name="birth_date"
            type="date"
            defaultValue={person?.birth_date ?? ""}
          />
        </Field>
        <Field label="DNI/NIE">
          <Input
            name="tax_id"
            defaultValue={person?.tax_id ?? ""}
            onBlur={handleDuplicateFieldBlur}
          />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            defaultValue={person?.email ?? ""}
            onBlur={handleDuplicateFieldBlur}
          />
        </Field>
        <Field label="Teléfono">
          <Input
            name="phone"
            defaultValue={person?.phone ?? ""}
            onBlur={handleDuplicateFieldBlur}
          />
        </Field>
      </div>

      <CheckboxField
        name="is_patient"
        label="Es paciente"
        defaultChecked={person?.is_patient ?? !guardianOf}
      />

      {guardianOf && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parentesco">
            <Select
              name="relationship"
              defaultValue="madre"
              data-testid="guardian-relationship"
            >
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <CheckboxField
            name="is_primary"
            label="Tutor/a principal"
            data-testid="guardian-primary"
          />
        </div>
      )}

      <Field label="Dirección">
        <Input name="address" defaultValue={person?.address ?? ""} />
      </Field>

      <Field label="Notas administrativas">
        <Textarea name="admin_notes" defaultValue={person?.admin_notes ?? ""} />
      </Field>

      {duplicates.length > 0 && (
        <DuplicateWarning
          duplicates={duplicates}
          onUseExisting={handleUseExisting}
          onContinue={() => {
            checkerRef.current.markResolved(currentFields(), []);
            setDuplicates([]);
          }}
        />
      )}

      {(state?.error || useExistingError) && (
        <p
          role="alert"
          data-testid="person-error"
          className="text-[13px] text-danger-600"
        >
          {state?.error ?? useExistingError}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button
          type="submit"
          disabled={pending || checking || usingExisting}
          data-testid="person-submit"
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
