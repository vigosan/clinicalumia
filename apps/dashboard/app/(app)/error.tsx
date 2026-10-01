"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function AppError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <Card
      role="alert"
      data-testid="page-error"
      className="flex flex-col items-center gap-4 text-center"
    >
      <h1 className="text-xl font-bold text-ink-900">
        No se ha podido cargar esta página
      </h1>
      <p className="text-[15px] text-ink-800">
        Puede ser un fallo momentáneo de conexión. Vuelve a intentarlo.
      </p>
      <Button
        size="sm"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Reintentar
      </Button>
    </Card>
  );
}
