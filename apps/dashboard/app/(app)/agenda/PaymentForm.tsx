"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { RadioCards } from "@clinicalumia/ui/radio-cards";
import { Textarea } from "@clinicalumia/ui/textarea";
import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { RecipientDraft } from "@/lib/invoices";
import {
  METHOD_ORDER,
  methodLabel,
  needsPaymentNote,
  needsRecipient,
  type PaymentFailure,
  type PaymentMethod,
  parseAmount,
  recipientRequested,
} from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { collectPayment } from "../payments/actions";
import { ActionError } from "./ActionError";
import { RecipientFields } from "./RecipientFields";

const EMPTY_RECIPIENT: RecipientDraft = {
  name: "",
  taxId: "",
  address: "",
  postalCode: "",
  city: "",
};

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote />,
  card: <CreditCard />,
  bizum: <Smartphone />,
  transfer: <Landmark />,
};

export function PaymentForm({
  appointmentId,
  suggestedAmountCents,
  cancelled,
  recipient: initialRecipient = EMPTY_RECIPIENT,
  initiallyOpen = false,
  onSuccess,
  onError,
  onPendingChange,
}: {
  appointmentId: string;
  suggestedAmountCents: number;
  cancelled: boolean;
  recipient?: RecipientDraft;
  initiallyOpen?: boolean;
  onSuccess?: (payment: { cents: number; method: PaymentMethod }) => void;
  onError?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [amount, setAmount] = useState(
    (suggestedAmountCents / 100).toFixed(2).replace(".", ","),
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [requested, setRequested] = useState(false);
  const [failure, setFailure] = useState<PaymentFailure | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const needsNote = needsPaymentNote({
    cancelled,
    amount,
    suggestedAmountCents,
    error: failure?.error ?? null,
  });
  const askRecipient = needsRecipient({ amount, requested });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await collectPayment(appointmentId, {
        amount,
        method,
        note: needsNote ? note : "",
        recipient: askRecipient ? recipient : undefined,
      });
      submitGateRef.current.finish();
      if ("error" in result) {
        setFailure(result);
        setRequested((previous) => recipientRequested(previous, result.error));
        onError?.();
        return;
      }
      setFailure(null);
      setOpen(false);
      const parsed = parseAmount(amount);
      onSuccess?.({ cents: "cents" in parsed ? parsed.cents : 0, method });
    });
  }

  if (!open) {
    return (
      <div>
        <Button
          type="button"
          className="w-full"
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
      <RadioCards
        label="Forma de pago"
        name="method"
        value={method}
        onValueChange={(value) => setMethod(value as PaymentMethod)}
        options={METHOD_ORDER.map((option) => ({
          value: option,
          label: methodLabel(option),
          icon: METHOD_ICONS[option],
          testId: `payment-method-${option}`,
        }))}
      />
      {needsNote && (
        <Field label="Motivo del cambio de importe">
          <Textarea
            data-testid="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      )}
      {askRecipient && (
        <fieldset
          data-testid="payment-recipient"
          className="flex flex-col gap-3"
        >
          <legend className="mb-1 text-[13px] text-ink-700">
            Más de 400 €: se emite factura completa
          </legend>
          <RecipientFields
            value={recipient}
            onChange={setRecipient}
            testIdPrefix="payment-recipient"
          />
        </fieldset>
      )}
      {failure && <ActionError failure={failure} testId="payment-error" />}
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
