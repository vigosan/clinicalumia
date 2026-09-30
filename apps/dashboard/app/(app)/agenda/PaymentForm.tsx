"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Textarea } from "@clinicalumia/ui/textarea";
import { useRef, useState, useTransition } from "react";
import {
  METHOD_ORDER,
  methodLabel,
  needsPaymentNote,
  type PaymentMethod,
} from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { collectPayment } from "../payments/actions";

export function PaymentForm({
  appointmentId,
  suggestedAmountCents,
  cancelled,
}: {
  appointmentId: string;
  suggestedAmountCents: number;
  cancelled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    (suggestedAmountCents / 100).toFixed(2).replace(".", ","),
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  const needsNote = needsPaymentNote({
    cancelled,
    amount,
    suggestedAmountCents,
    error,
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await collectPayment(appointmentId, {
        amount,
        method,
        note: needsNote ? note : "",
      });
      submitGateRef.current.finish();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div>
        <Button
          type="button"
          size="sm"
          data-testid="payment-collect"
          onClick={() => setOpen(true)}
        >
          Cobrar
        </Button>
      </div>
    );
  }

  return (
    <form
      data-testid="payment-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <Field label="Importe (€)">
        <Input
          inputMode="decimal"
          data-testid="payment-amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] text-ink-800">Forma de pago</legend>
        {METHOD_ORDER.map((option) => (
          <label
            key={option}
            className="flex items-center gap-3 text-[15px] text-ink-900"
          >
            <input
              type="radio"
              name="method"
              value={option}
              checked={method === option}
              onChange={() => setMethod(option)}
              data-testid={`payment-method-${option}`}
              className="size-4 accent-sage-600"
            />
            {methodLabel(option)}
          </label>
        ))}
      </fieldset>
      {needsNote && (
        <Field label="Motivo">
          <Textarea
            data-testid="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      )}
      {error && (
        <p
          role="alert"
          data-testid="payment-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
      <div>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          data-testid="payment-submit"
        >
          {pending ? "Registrando…" : "Registrar cobro"}
        </Button>
      </div>
    </form>
  );
}
