"use client";

import { Button } from "@clinicalumia/ui/button";
import { cn } from "@clinicalumia/ui/cn";
import { Field } from "@clinicalumia/ui/field";
import { fieldControl } from "@clinicalumia/ui/input";
import { startTransition, useActionState, useState } from "react";
import { validateLogoFile } from "@/lib/logo";
import { type UploadLogoState, uploadLogo } from "./actions";

export function LogoUploader() {
  const [state, formAction, pending] = useActionState<
    UploadLogoState,
    FormData
  >(uploadLogo, undefined);
  const [clientError, setClientError] = useState<string | null>(null);

  const error =
    clientError ?? (state && "error" in state ? state.error : undefined);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const file = formData.get("logo");
        if (file instanceof File && file.size > 0) {
          const validation = validateLogoFile(file);
          if ("error" in validation) {
            setClientError(validation.error);
            return;
          }
        }
        setClientError(null);
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
      {error && (
        <p
          role="alert"
          data-testid="logo-error"
          className="text-[13px] text-danger-600"
        >
          {error}
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
