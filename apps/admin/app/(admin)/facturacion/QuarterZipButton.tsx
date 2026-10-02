"use client";

import { Button } from "@clinicalumia/ui/button";
import { cn } from "@clinicalumia/ui/cn";
import { toast } from "@clinicalumia/ui/toast";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

const FALLBACK_ERROR = "No se ha podido preparar el ZIP. Inténtalo de nuevo.";

async function requestZip(year: number, q: number): Promise<string> {
  const response = await fetch(`/facturacion/zip?year=${year}&q=${q}`, {
    method: "POST",
  }).catch(() => null);
  const body: { url?: string; error?: string } | null = response
    ? await response.json().catch(() => null)
    : null;
  if (!response?.ok || !body?.url)
    throw new Error(body?.error ?? FALLBACK_ERROR);
  return body.url;
}

const labelClass = "col-start-1 row-start-1 inline-flex justify-center gap-2";

export function QuarterZipButton({ year, q }: { year: number; q: number }) {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      window.location.assign(await requestZip(year, q));
    } catch (failure) {
      toast((failure as Error).message, { tone: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={download}
      data-testid="quarter-download-zip"
    >
      <span className="grid">
        <span
          aria-hidden={pending}
          className={cn(labelClass, pending && "invisible")}
        >
          Descargar PDF (ZIP)
        </span>
        <span
          aria-hidden={!pending}
          className={cn(labelClass, !pending && "invisible")}
        >
          <LoaderCircle
            aria-hidden="true"
            data-testid={pending ? "quarter-zip-spinner" : undefined}
            className={cn("self-center", pending && "motion-safe:animate-spin")}
          />
          Preparando…
        </span>
      </span>
    </Button>
  );
}
