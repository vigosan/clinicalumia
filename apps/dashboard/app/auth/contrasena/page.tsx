"use client";

import { AuthCard } from "@clinicalumia/ui/auth-card";
import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
import { startTransition, useActionState } from "react";
import { type PasswordState, setPassword } from "./actions";

const initialState: PasswordState = undefined;

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    setPassword,
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
      title="Elige tu contraseña"
    >
      <form
        data-testid="password-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Contraseña" hint="Mínimo 12 caracteres.">
          <Input
            type="password"
            name="password"
            required
            autoComplete="new-password"
          />
        </Field>
        <Field label="Repite la contraseña">
          <Input
            type="password"
            name="confirmation"
            required
            autoComplete="new-password"
          />
        </Field>
        {state?.error && (
          <p
            role="alert"
            data-testid="password-error"
            className="text-[13px] text-danger-600"
          >
            {state.error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          data-testid="password-submit"
          className="w-full"
        >
          {pending ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </AuthCard>
  );
}
