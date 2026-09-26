"use client";

import { Button } from "@clinicalumia/ui/button";
import { useState, useTransition } from "react";
import { setServiceActive } from "./actions";

export function ServiceStatusToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={isActive ? "danger" : "secondary"}
        disabled={pending}
        data-testid="service-toggle"
        onClick={() =>
          startTransition(async () => {
            const result = await setServiceActive(id, !isActive);
            setError("error" in result ? result.error : null);
          })
        }
      >
        {isActive ? "Desactivar" : "Activar"}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
