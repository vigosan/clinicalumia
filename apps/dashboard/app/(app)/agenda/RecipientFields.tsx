"use client";

import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import type { RecipientDraft } from "@/lib/invoices";

const FIELDS: {
  key: keyof RecipientDraft;
  label: string;
  testIdSuffix: string;
  autoComplete: string;
  inputMode?: "numeric";
}[] = [
  {
    key: "name",
    label: "Nombre o razón social",
    testIdSuffix: "name",
    autoComplete: "name",
  },
  {
    key: "taxId",
    label: "NIF",
    testIdSuffix: "tax-id",
    autoComplete: "off",
  },
  {
    key: "address",
    label: "Dirección",
    testIdSuffix: "address",
    autoComplete: "street-address",
  },
  {
    key: "postalCode",
    label: "Código postal",
    testIdSuffix: "postal-code",
    autoComplete: "postal-code",
    inputMode: "numeric",
  },
  {
    key: "city",
    label: "Ciudad",
    testIdSuffix: "city",
    autoComplete: "address-level2",
  },
];

export function RecipientFields({
  value,
  onChange,
  testIdPrefix,
}: {
  value: RecipientDraft;
  onChange: (value: RecipientDraft) => void;
  testIdPrefix: string;
}) {
  return FIELDS.map((field) => (
    <Field key={field.key} label={field.label}>
      <Input
        data-testid={`${testIdPrefix}-${field.testIdSuffix}`}
        required
        autoComplete={field.autoComplete}
        inputMode={field.inputMode}
        value={value[field.key]}
        onChange={(event) =>
          onChange({ ...value, [field.key]: event.target.value })
        }
      />
    </Field>
  ));
}
