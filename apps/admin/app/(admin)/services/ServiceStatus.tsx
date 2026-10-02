"use client";

import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { TableCell } from "@clinicalumia/ui/table";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setServiceActive } from "./actions";

export function ServiceStatus({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setOptimisticActive] = useOptimistic(isActive);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <TableCell label="Estado">
        <Badge tone={active ? "success" : "neutral"}>
          {active ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell className="max-md:mt-2 max-md:justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            data-testid="service-edit"
          >
            <Link href={`/services/${id}`}>Editar</Link>
          </Button>
          <div className="flex flex-col items-start gap-1">
            <Button
              type="button"
              size="sm"
              variant={active ? "danger" : "secondary"}
              disabled={pending}
              data-testid="service-toggle"
              onClick={() =>
                startTransition(async () => {
                  setOptimisticActive(!isActive);
                  const result = await setServiceActive(id, !isActive);
                  setError("error" in result ? result.error : null);
                })
              }
            >
              {active ? "Desactivar" : "Activar"}
            </Button>
            {error && (
              <p role="alert" className="text-[13px] text-danger-600">
                {error}
              </p>
            )}
          </div>
        </div>
      </TableCell>
    </>
  );
}
