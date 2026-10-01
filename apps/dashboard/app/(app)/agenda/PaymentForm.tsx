"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { RadioCards } from "@clinicalumia/ui/radio-cards";
import { Textarea } from "@clinicalumia/ui/textarea";
import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  METHOD_ORDER,
  methodLabel,
  needsPaymentNote,
  type PaymentMethod,
} from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { collectPayment } from "../payments/actions";

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
  initiallyOpen = false,
  onSuccess,
}: {
  appointmentId: string;
  suggestedAmountCents: number;
  cancelled: boolean;
  initiallyOpen?: boolean;
  onSuccess?: (payment: { amount: string; method: PaymentMethod }) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
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
      onSuccess?.({ amount, method });
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
