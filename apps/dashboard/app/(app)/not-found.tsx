import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function AppNotFound() {
  return (
    <Card
      data-testid="not-found"
      className="flex flex-col items-center gap-4 text-center"
    >
      <h1 className="text-xl font-bold text-ink-900">
        No hemos encontrado esta página
      </h1>
      <p className="text-[15px] text-ink-800">
        Puede que la ficha o el documento se haya eliminado o que el enlace no
        sea correcto.
      </p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/">Ir a la agenda</Link>
      </Button>
    </Card>
  );
}
