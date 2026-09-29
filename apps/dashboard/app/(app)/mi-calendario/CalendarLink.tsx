"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { useState, useTransition } from "react";
import { regenerateCalendarLink } from "./actions";

export function CalendarLink({ url }: { url: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateCalendarLink();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setCopied(false);
      setOpen(false);
    });
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {url ? (
        <>
          <p
            data-testid="calendar-url"
            className="break-all rounded-card bg-cream-50 p-3 font-mono text-sm text-ink-900"
          >
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              data-testid="calendar-copy"
              onClick={handleCopy}
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  data-testid="calendar-regenerate"
                >
                  Cambiar enlace
                </Button>
              }
              title="¿Cambiar el enlace?"
              description="El enlace actual dejará de funcionar al momento. Tendrás que volver a suscribirte con el nuevo en cada calendario."
              confirmLabel={pending ? "Cambiando…" : "Cambiar enlace"}
              cancelLabel="Volver"
              confirmTestId="calendar-regenerate-confirm"
              open={open}
              onOpenChange={setOpen}
              closeOnConfirm={false}
              onConfirm={handleRegenerate}
            />
          </div>
        </>
      ) : (
        <div>
          <Button
            type="button"
            disabled={pending}
            data-testid="calendar-generate"
            onClick={handleRegenerate}
          >
            Generar enlace
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          data-testid="calendar-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
