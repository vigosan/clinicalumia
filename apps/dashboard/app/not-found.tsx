import { Button } from "@clinicalumia/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-cream-50 px-4 text-center">
      <h1 className="text-title font-bold text-ink-900">
        No hemos encontrado esta página
      </h1>
      <p className="text-[15px] text-ink-800">
        Revisa el enlace o vuelve al panel.
      </p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/">Ir a la agenda</Link>
      </Button>
    </main>
  );
}
