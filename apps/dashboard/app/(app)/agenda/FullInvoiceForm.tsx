"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useRef, useState, useTransition } from "react";
import type { RecipientDraft } from "@/lib/invoices";
import type { PaymentFailure } from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { issueFullInvoice } from "../facturas/actions";
import { ActionError } from "./ActionError";

const FIELDS: {
  key: keyof RecipientDraft;
  label: string;
  testId: string;
  autoComplete: string;
  inputMode?: "numeric";
}[] = [
  {
    key: "name",
    label: "Nombre o razón social",
    testId: "invoice-full-name",
    autoComplete: "name",
  },
  {
    key: "taxId",
    label: "NIF",
    testId: "invoice-full-tax-id",
    autoComplete: "off",
  },
  {
    key: "address",
    label: "Dirección",
    testId: "invoice-full-address",
    autoComplete: "street-address",
  },
  {
    key: "postalCode",
    label: "Código postal",
    testId: "invoice-full-postal-code",
    autoComplete: "postal-code",
    inputMode: "numeric",
  },
  {
    key: "city",
    label: "Ciudad",
    testId: "invoice-full-city",
    autoComplete: "address-level2",
  },
];

export function FullInvoiceForm({
  invoiceId,
  recipient,
}: {
  invoiceId: string;
  recipient: RecipientDraft;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(recipient);
  const [failure, setFailure] = useState<PaymentFailure | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      try {
        const result = await issueFullInvoice(invoiceId, draft);
        if ("error" in result) {
          setFailure(result);
          return;
        }
        setFailure(null);
        setOpen(false);
      } finally {
        submitGateRef.current.finish();
      }
    });
  }

  if (!open) {
    return (
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="invoice-full"
          onClick={() => setOpen(true)}
        >
          Factura completa
        </Button>
      </div>
    );
  }

  return (
    <form
      data-testid="invoice-full-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label}>
          <Input
            data-testid={field.testId}
            required
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            value={draft[field.key]}
            onChange={(event) =>
              setDraft({ ...draft, [field.key]: event.target.value })
            }
          />
        </Field>
      ))}
      {failure && <ActionError failure={failure} testId="invoice-full-error" />}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          data-testid="invoice-full-submit"
        >
          {pending ? "Emitiendo…" : "Emitir factura completa"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFailure(null);
            setOpen(false);
          }}
        >
          Volver
        </Button>
      </div>
    </form>
  );
}
