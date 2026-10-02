"use client";

import { Button } from "@clinicalumia/ui/button";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { RecipientDraft } from "@/lib/invoices";
import type { PaymentFailure } from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { correctInvoiceRecipient, issueFullInvoice } from "../facturas/actions";
import { ActionError } from "./ActionError";
import { RecipientFields } from "./RecipientFields";

export function FullInvoiceForm({
  invoiceId,
  recipient,
  correct = false,
}: {
  invoiceId: string;
  recipient: RecipientDraft;
  correct?: boolean;
}) {
  const router = useRouter();
  const testId = correct ? "invoice-correct" : "invoice-full";
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
        const result = correct
          ? await correctInvoiceRecipient(invoiceId, draft)
          : await issueFullInvoice(invoiceId, draft);
        if ("error" in result) {
          setFailure(result);
          return;
        }
        setFailure(null);
        setOpen(false);
        if ("id" in result) router.push(`/facturas/${result.id}`);
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
          data-testid={testId}
          onClick={() => setOpen(true)}
        >
          {correct ? "Corregir destinatario" : "Factura completa"}
        </Button>
      </div>
    );
  }

  return (
    <form
      data-testid={`${testId}-form`}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      {correct && (
        <p className="text-[13px] text-ink-800">
          Se emitirá una rectificativa que anula esta factura y una nueva
          factura completa con estos datos. El cobro no cambia.
        </p>
      )}
      <RecipientFields
        value={draft}
        onChange={setDraft}
        testIdPrefix={testId}
      />
      {failure && <ActionError failure={failure} testId={`${testId}-error`} />}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          data-testid={`${testId}-submit`}
        >
          {pending
            ? "Emitiendo…"
            : correct
              ? "Emitir rectificativa y nueva factura"
              : "Emitir factura completa"}
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
