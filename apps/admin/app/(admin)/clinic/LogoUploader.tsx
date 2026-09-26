"use client";

import { Button } from "@clinicalumia/ui/button";
import { cn } from "@clinicalumia/ui/cn";
import { Field } from "@clinicalumia/ui/field";
import { fieldControl } from "@clinicalumia/ui/input";
import { startTransition, useActionState } from "react";
import { type UploadLogoState, uploadLogo } from "./actions";

export function LogoUploader() {
  const [state, formAction, pending] = useActionState<
    UploadLogoState,
    FormData
  >(uploadLogo, undefined);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Logo">
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          data-testid="logo-input"
          className={cn(fieldControl, "h-auto py-2")}
        />
      </Field>
      {state && "error" in state && (
        <p
          role="alert"
          data-testid="logo-error"
          className="text-[13px] text-danger-600"
        >
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending} data-testid="logo-submit">
          {pending ? "Subiendo…" : "Subir logo"}
        </Button>
      </div>
    </form>
  );
}
