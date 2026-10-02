"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { DateInput } from "@clinicalumia/ui/date-input";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { SwitchField } from "@clinicalumia/ui/switch";
import { Textarea } from "@clinicalumia/ui/textarea";
import { toast } from "@clinicalumia/ui/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { consentOwnTaxId } from "@/lib/consents";
import {
  createDuplicateChecker,
  type DuplicateFields,
  hasDuplicateInput,
} from "@/lib/duplicate-checker";
import { newPersonToast } from "@/lib/person-toast";
import { createSubmitGate } from "@/lib/submit-gate";
import { toastOnRedirect } from "@/lib/toast-on-redirect";
import type { Ward } from "@/lib/ward-label";
import { linkConsent } from "../consentimientos/actions";
import {
  addGuardian,
  checkDuplicates,
  type Duplicate,
  savePerson,
  setArchived,
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

export type ConsentPrefill = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  tax_id: string | null;
  guardian_tax_id: string | null;
  email: string | null;
  guardian_name: string;
};

export function PersonForm({
  person,
  guardianOf,
  returnTo,
  consent,
  isOwner,
}: {
  person?: Person;
  guardianOf?: GuardianOf;
  returnTo?: string;
  consent?: ConsentPrefill;
  isOwner: boolean;
}) {
  const router = useRouter();
  const personId = person?.id;
  const guardianOfId = guardianOf?.id;
  const save = useMemo(
    () =>
      toastOnRedirect(savePerson, (location) =>
        personId ? "Ficha guardada" : newPersonToast(location, guardianOfId),
      ),
    [personId, guardianOfId],
  );
  const [state, formAction, pending] = useActionState(save, undefined);
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
      first_name: String(data.get("first_name") ?? "").trim(),
      last_name: String(data.get("last_name") ?? "").trim(),
      birth_date: String(data.get("birth_date") ?? "").trim(),
    };
  }

  async function resolveDuplicates(): Promise<Duplicate[]> {
    const fields = currentFields();
    if (!hasDuplicateInput(fields)) return [];
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
    if (consent) {
      setUseExistingError(null);
      startUsingExisting(async () => {
        const result = await linkConsent(consent.id, id);
        if ("error" in result) {
          setUseExistingError(result.error);
          return;
        }
        toast("Consentimiento asociado");
        router.push(`/consentimientos/${consent.id}`);
      });
      return;
    }
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
      toast("Tutor/a añadido/a");
      router.push(`/patients/${guardianOf.id}`);
    });
  }

  function handleUnarchive(id: string) {
    setUseExistingError(null);
    startUsingExisting(async () => {
      const result = await setArchived(id, false);
      if ("error" in result) {
        setUseExistingError(result.error);
        return;
      }
      setDuplicates((current) =>
        current.map((duplicate) =>
          duplicate.id === id ? { ...duplicate, archived: false } : duplicate,
        ),
      );
      toast("Ficha desarchivada");
      handleUseExisting(id);
    });
  }

  const cancelHref = person
    ? `/patients/${person.id}`
    : guardianOf
      ? `/patients/${guardianOf.id}`
      : consent
        ? `/consentimientos/${consent.id}`
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
      className="@container flex flex-col gap-5"
    >
      {person && <input type="hidden" name="id" value={person.id} />}
      {guardianOf && (
        <input type="hidden" name="guardian_of" value={guardianOf.id} />
      )}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      {consent && <input type="hidden" name="consent_id" value={consent.id} />}
      <div className="grid gap-4 @xl:grid-cols-2">
        <Field
          label="Nombre"
          hint={
            consent?.guardian_name
              ? `Firmado por: ${consent.guardian_name}`
              : undefined
          }
        >
          <Input
            name="first_name"
            defaultValue={person?.first_name ?? consent?.first_name}
            onBlur={handleDuplicateFieldBlur}
            required
          />
        </Field>
        <Field label="Apellidos">
          <Input
            name="last_name"
            defaultValue={person?.last_name ?? consent?.last_name}
            onBlur={handleDuplicateFieldBlur}
            required
          />
        </Field>
        <Field label="Fecha de nacimiento">
          <DateInput
            name="birth_date"
            max={todayInMadrid()}
            defaultValue={person?.birth_date ?? consent?.birth_date ?? ""}
            onBlur={handleDuplicateFieldBlur}
          />
        </Field>
        <Field
          label="DNI/NIE"
          hint={
            consent?.guardian_name && !consent.guardian_tax_id
              ? `El DNI del consentimiento puede ser del tutor/a: ${consent.tax_id}`
              : undefined
          }
        >
          <Input
            name="tax_id"
            defaultValue={
              person?.tax_id ?? (consent && consentOwnTaxId(consent)) ?? ""
            }
            onBlur={handleDuplicateFieldBlur}
          />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            defaultValue={person?.email ?? consent?.email ?? ""}
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

      {person || guardianOf || consent ? (
        <SwitchField
          name="is_patient"
          data-testid="person-is-patient"
          label={
            guardianOf
              ? "También es paciente (recibe tratamiento)"
              : "Es paciente (recibe tratamiento)"
          }
          defaultChecked={person?.is_patient ?? !guardianOf}
        />
      ) : (
        <input type="hidden" name="is_patient" value="on" />
      )}

      {guardianOf && (
        <div className="grid gap-4 @xl:grid-cols-2">
          <Field label="Parentesco">
            <Select
              name="relationship"
              defaultValue="madre"
              data-testid="guardian-relationship"
              options={RELATIONSHIP_OPTIONS}
            />
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
          isOwner={isOwner}
          onUseExisting={handleUseExisting}
          onUnarchive={handleUnarchive}
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
          {state?.existingId && (
            <>
              {" "}
              <Link
                href={`/patients/${state.existingId}`}
                data-testid="person-error-existing"
                className="font-medium underline"
              >
                Ver la ficha
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button
          type="submit"
          disabled={pending || checking || usingExisting}
          data-testid="person-submit"
        >
          {pending ? "Guardando…" : person ? "Guardar cambios" : "Crear ficha"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
