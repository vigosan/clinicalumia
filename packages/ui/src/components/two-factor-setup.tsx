"use client";

import Image from "next/image";
import { startTransition, useActionState } from "react";
import logo from "../assets/logo-dark.png";
import { AuthCard } from "./auth-card";
import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";

export type TwoFactorFormState = { error: string } | undefined;

export function TwoFactorSetup({
  qrCode,
  secret,
  factorId,
  action,
}: {
  qrCode: string;
  secret: string;
  factorId: string;
  action: (
    state: TwoFactorFormState,
    formData: FormData,
  ) => Promise<TwoFactorFormState>;
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
      title="Protege tu cuenta"
    >
      <ol className="flex flex-col gap-2 text-[15px] text-ink-800">
        <li>
          1. Instala una app de autenticación (Google Authenticator, Microsoft
          Authenticator o 1Password).
        </li>
        <li>2. Escanea el código QR o escribe la clave.</li>
        <li>3. Escribe el código de 6 dígitos.</li>
      </ol>

      <div className="flex flex-col items-center gap-3">
        <Image
          src={qrCode}
          alt="Código QR para tu app de autenticación"
          data-testid="totp-qr"
          width={200}
          height={200}
          unoptimized
        />
        <p
          data-testid="totp-secret"
          className="rounded-field bg-cream-50 px-3.5 py-2 text-[13px] tracking-wide text-ink-900"
        >
          {secret}
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="factorId" value={factorId} />
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
          {pending ? "Comprobando…" : "Activar"}
        </Button>
      </form>
    </AuthCard>
  );
}
