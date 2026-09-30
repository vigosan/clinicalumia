"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useRef, useState, useTransition } from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { sendInvoiceEmail } from "../facturas/actions";

export function SendInvoiceForm({
  invoiceId,
  proposedEmail,
}: {
  invoiceId: string;
  proposedEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(proposedEmail);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      try {
        const result = await sendInvoiceEmail(invoiceId, email);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setError(null);
        setSentTo(result.email);
        setOpen(false);
      } finally {
        submitGateRef.current.finish();
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="invoice-send"
            onClick={() => {
              setSentTo(null);
              setOpen(true);
            }}
          >
            Enviar por email
          </Button>
        </div>
        {sentTo && (
          <p
            role="status"
            data-testid="invoice-send-result"
            className="text-[13px] text-ink-800"
          >
            Factura enviada a {sentTo}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      data-testid="invoice-send-form"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <Field label="Email">
        <Input
          type="email"
          data-testid="invoice-send-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {error && (
        <p
          role="alert"
          data-testid="invoice-send-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          data-testid="invoice-send-submit"
        >
          {pending ? "Enviando…" : "Enviar factura"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Volver
        </Button>
      </div>
    </form>
  );
}
