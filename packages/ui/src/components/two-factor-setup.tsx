"use client";

import Image from "next/image";
import {
  startTransition,
  useActionState,
  useState,
  useTransition,
} from "react";
import logo from "../assets/logo-dark.png";
import { AuthCard } from "./auth-card";
import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";

export type TwoFactorFormState = { error: string } | undefined;

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorSetup({
  startAction,
  confirmAction,
  logoutAction,
}: {
  startAction: () => Promise<Enrollment | { error: string }>;
  confirmAction: (
    state: TwoFactorFormState,
    formData: FormData,
  ) => Promise<TwoFactorFormState>;
  logoutAction: () => void | Promise<void>;
}) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startStartTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    TwoFactorFormState,
    FormData
  >(confirmAction, undefined);

  function handleStart() {
    setStartError(null);
    startStartTransition(async () => {
      const result = await startAction();
      if ("error" in result) {
        setStartError(result.error);
        return;
      }
      setEnrollment(result);
    });
  }

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

      {!enrollment && (
        <div className="flex flex-col gap-4">
          {startError && (
            <p
              role="alert"
              data-testid="totp-error"
              className="text-[13px] text-danger-600"
            >
              {startError}
            </p>
          )}
          <Button
            type="button"
            onClick={handleStart}
            disabled={starting}
            data-testid="totp-start"
            className="w-full"
          >
            {starting ? "Preparando…" : "Empezar"}
          </Button>
        </div>
      )}

      {enrollment && (
        <>
          <div className="flex flex-col items-center gap-3">
            <Image
              src={enrollment.qrCode}
              alt="Código QR para tu app de autenticación"
              data-testid="totp-qr"
              width={200}
              height={200}
              unoptimized
            />
            <p
              data-testid="totp-secret"
              className="w-full break-all rounded-field bg-cream-50 px-3.5 py-2 text-center text-[13px] tracking-wide text-ink-900"
            >
              {groupSecret(enrollment.secret)}
            </p>
            <a
              href={enrollment.uri}
              data-testid="totp-open-app"
              className="text-[13px] text-sage-800 underline underline-offset-4 hover:text-sage-900"
            >
              Abrir en la app de autenticación
            </a>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(() => formAction(formData));
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="factorId" value={enrollment.factorId} />
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
        </>
      )}

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
