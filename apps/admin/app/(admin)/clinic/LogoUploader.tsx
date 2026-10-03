"use client";

import { Button, buttonVariants } from "@clinicalumia/ui/button";
import { cn } from "@clinicalumia/ui/cn";
import { Label } from "@clinicalumia/ui/label";
import { startTransition, useActionState, useId, useState } from "react";
import { validateLogoFile } from "@/lib/logo";
import { type UploadLogoState, uploadLogo } from "./actions";

export function LogoUploader() {
  const [state, formAction, pending] = useActionState<
    UploadLogoState,
    FormData
  >(uploadLogo, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputId = useId();

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={inputId}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            data-testid="logo-input"
            aria-invalid={error ? true : undefined}
            onChange={(event) =>
              setFileName(event.currentTarget.files?.[0]?.name ?? null)
            }
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-800",
            )}
          >
            Elegir archivo
          </label>
          <span
            data-testid="logo-file-name"
            className="min-w-0 truncate text-[15px] text-ink-800"
          >
            {fileName ?? "Ningún archivo elegido"}
          </span>
        </div>
      </div>
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
