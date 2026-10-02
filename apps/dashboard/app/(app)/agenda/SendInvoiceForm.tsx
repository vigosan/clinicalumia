"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Drawer } from "@clinicalumia/ui/drawer";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { useRef, useState, useTransition } from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { sendInvoiceEmail } from "../facturas/actions";

export function SendInvoiceForm({
  invoiceId,
  proposedEmail,
  saveEmail = false,
  asDrawer = false,
}: {
  invoiceId: string;
  proposedEmail: string;
  saveEmail?: boolean;
  asDrawer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(proposedEmail);
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      try {
        const result = await sendInvoiceEmail(
          invoiceId,
          email,
          saveEmail && save,
        );
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setError(null);
        setSentTo(result.email);
        setOpen(false);
      } catch {
        setError("No se ha podido enviar el email. Inténtalo de nuevo.");
      } finally {
        submitGateRef.current.finish();
      }
    });
  }

  const closedView = (
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

  const formView = (
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
      {saveEmail && (
        <CheckboxField
          label="Guardar en la ficha"
          data-testid="invoice-send-save"
          checked={save}
          onChange={(event) => setSave(event.target.checked)}
        />
      )}
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
          {asDrawer ? "Cancelar" : "Volver"}
        </Button>
      </div>
    </form>
  );

  if (asDrawer) {
    return (
      <>
        {closedView}
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Enviar por email"
          description="La factura va adjunta en PDF."
          data-testid="invoice-send-drawer"
        >
          {formView}
        </Drawer>
      </>
    );
  }

  return open ? formView : closedView;
}
