"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Ward } from "@/lib/ward-label";
import { removeGuardian } from "../actions";
import { RELATIONSHIP_LABEL } from "../relationship-options";
import { AddGuardian } from "./AddGuardian";

export type GuardianRow = {
  id: string;
  name: string;
  relationship: Ward["relationship"];
  isPrimary: boolean;
};

export function GuardiansSection({
  personId,
  isMinorPerson,
  guardians,
  wards,
  initialError,
}: {
  personId: string;
  isMinorPerson: boolean;
  guardians: GuardianRow[];
  wards: GuardianRow[];
  initialError?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);

  function handleRemove(guardianId: string) {
    startTransition(async () => {
      const result = await removeGuardian(personId, guardianId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      {(isMinorPerson || guardians.length > 0) && (
        <>
          <h2 className="text-lg font-bold text-ink-900">Tutores</h2>
          {guardians.length === 0 ? (
            <p className="text-sm text-ink-800">No tiene tutor/a.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {guardians.map((guardian) => (
                <li
                  key={guardian.id}
                  data-testid="guardian-row"
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-[15px] text-ink-900">
                    <Link
                      href={`/patients/${guardian.id}`}
                      data-testid="guardian-link"
                    >
                      {guardian.name}
                    </Link>{" "}
                    · {RELATIONSHIP_LABEL[guardian.relationship]}
                    {guardian.isPrimary && " · Principal"}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    data-testid="guardian-remove"
                    onClick={() => handleRemove(guardian.id)}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {isMinorPerson && (
            <AddGuardian minorId={personId} onError={setError} />
          )}
        </>
      )}
      {!isMinorPerson && wards.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-ink-900">Menores a su cargo</h2>
          <ul className="flex flex-col gap-2">
            {wards.map((ward) => (
              <li
                key={ward.id}
                data-testid="ward-row"
                className="text-[15px] text-ink-900"
              >
                <Link href={`/patients/${ward.id}`} data-testid="ward-link">
                  {ward.name}
                </Link>{" "}
                · {RELATIONSHIP_LABEL[ward.relationship]}
                {ward.isPrimary && " · Principal"}
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p
          role="alert"
          data-testid="guardian-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </Card>
  );
}
