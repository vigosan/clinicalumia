"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Textarea } from "@clinicalumia/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { checkDuplicates, type Duplicate, savePerson } from "./actions";
import { DuplicateWarning } from "./DuplicateWarning";

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

export function PersonForm({ person }: { person?: Person }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(savePerson, undefined);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckRef = useRef("");

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleDuplicateFieldBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const data = new FormData(form);
      const tax_id = String(data.get("tax_id") ?? "").trim();
      const email = String(data.get("email") ?? "").trim();
      const phone = String(data.get("phone") ?? "").trim();
      if (!tax_id && !email && !phone) return;
      const key = JSON.stringify({ tax_id, email, phone });
      if (key === lastCheckRef.current) return;
      lastCheckRef.current = key;
      void checkDuplicates({
        tax_id,
        email,
        phone,
        exclude: person?.id,
      }).then(setDuplicates);
    }, 300);
  }

  return (
    <form
      ref={formRef}
      data-testid="person-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (duplicates.length > 0) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
    >
      {person && <input type="hidden" name="id" value={person.id} />}
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
        defaultChecked={person?.is_patient ?? true}
      />

      <Field label="Dirección">
        <Input name="address" defaultValue={person?.address ?? ""} />
      </Field>

      <Field label="Notas administrativas">
        <Textarea name="admin_notes" defaultValue={person?.admin_notes ?? ""} />
      </Field>

      {duplicates.length > 0 && (
        <DuplicateWarning
          duplicates={duplicates}
          onUseExisting={(id) => router.push(`/patients/${id}`)}
          onContinue={() => setDuplicates([])}
        />
      )}

      {state?.error && (
        <p
          role="alert"
          data-testid="person-error"
          className="text-[13px] text-danger-600"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" disabled={pending} data-testid="person-submit">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/patients">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
