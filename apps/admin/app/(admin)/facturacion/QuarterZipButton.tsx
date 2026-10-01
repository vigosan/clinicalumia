"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
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

export function QuarterZipButton({ year, q }: { year: number; q: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await requestZip(year, q));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={download}
        data-testid="quarter-download-zip"
      >
        {pending ? "Preparando…" : "Descargar PDF (ZIP)"}
      </Button>
      {error && (
        <Alert data-testid="quarter-zip-error" className="max-w-sm">
          {error}
        </Alert>
      )}
    </div>
  );
}
