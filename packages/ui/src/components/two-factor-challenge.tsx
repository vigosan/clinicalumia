"use client";

import Image from "next/image";
import { startTransition, useActionState } from "react";
import logo from "../assets/logo-dark.png";
import { AuthCard } from "./auth-card";
import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";

export type TwoFactorFormState = { error: string } | undefined;

export function TwoFactorChallenge({
  action,
  next,
  logoutAction,
  owner,
}: {
  action: (
    state: TwoFactorFormState,
    formData: FormData,
  ) => Promise<TwoFactorFormState>;
  next: string;
  logoutAction: () => void | Promise<void>;
  owner: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    TwoFactorFormState,
    FormData
  >(action, undefined);

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
      title="Verificación en dos pasos"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="next" value={next} />
        <Field
          label="Código de 6 dígitos"
          hint="Escribe los 6 dígitos que muestra tu app."
        >
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            data-testid="totp-code"
            required
          />
        </Field>
        {state?.error && (
          <p
            role="alert"
            data-testid="totp-error"
            className="text-[13px] text-danger-600"
          >
            {state.error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          data-testid="totp-submit"
          className="w-full"
        >
          {pending ? "Comprobando…" : "Verificar"}
        </Button>
      </form>
      <p
        data-testid="totp-lost-phone"
        className="text-center text-[13px] text-ink-800"
      >
        {owner
          ? "Si has perdido el móvil, contacta con el soporte técnico para restablecer la verificación."
          : "¿Has perdido el móvil? Pide que restablezcan tu verificación."}
      </p>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          data-testid="totp-logout"
          className="w-full"
        >
          Salir
        </Button>
      </form>
    </AuthCard>
  );
}
