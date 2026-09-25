"use client";

import { AuthCard } from "@clinicalumia/ui/auth-card";
import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
import { useActionState } from "react";
import { type LoginState, login } from "./actions";

const initialState: LoginState = undefined;

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState);

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
      title="Clínica LUMIA"
      subtitle="Acceso del equipo"
    >
      <form action={formAction} className="flex flex-col gap-4">
        {linkExpired && (
          <p
            role="alert"
            data-testid="login-link-expired"
            className="rounded-field bg-warning-100 px-3.5 py-2.5 text-[13px] text-warning-800"
          >
            El enlace ha caducado o ya se usó. Pide uno nuevo desde «¿Has
            olvidado tu contraseña?».
          </p>
        )}

        <Field label="Email">
          <Input type="email" name="email" required autoComplete="email" />
        </Field>

        <Field label="Contraseña" error={state?.error}>
          <Input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>

        <a
          href="/login/recuperar"
          className="text-center text-sm text-sage-800 underline underline-offset-4"
        >
          ¿Has olvidado tu contraseña?
        </a>
      </form>
    </AuthCard>
  );
}
