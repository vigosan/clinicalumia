"use client";

import { AuthCard } from "@clinicalumia/ui/auth-card";
import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
import { startTransition, useActionState } from "react";
import { type RecoverState, requestRecovery } from "./actions";

const initialState: RecoverState = undefined;

export default function RecoverPage() {
  const [state, formAction, pending] = useActionState(
    requestRecovery,
    initialState,
  );

  return (
    <AuthCard
      logo={
        <Image
          src={logo}
          alt="LUMIA · Clínica Logopedia miofuncional"
          width={160}
          priority
        />
      }
      title="Recuperar contraseña"
    >
      {state && "sent" in state ? (
        <p
          data-testid="recover-sent"
          className="text-center text-[15px] text-ink-800"
        >
          Si el email tiene cuenta, te hemos enviado un enlace para cambiar la
          contraseña.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Email">
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              data-testid="recover-email"
            />
          </Field>
          {state && "error" in state && (
            <p role="alert" className="text-[13px] text-danger-600">
              {state.error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            data-testid="recover-submit"
            className="w-full"
          >
            {pending ? "Enviando…" : "Enviarme el enlace"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
