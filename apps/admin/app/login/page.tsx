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

export default function LoginPage() {
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
      title="Administración"
      subtitle="Acceso restringido"
    >
      <form action={formAction} className="flex flex-col gap-4">
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
        <Button
          type="submit"
          disabled={pending}
          data-testid="login-submit"
          className="mt-2 w-full"
        >
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthCard>
  );
}
