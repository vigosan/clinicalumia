"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
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
  isOwner,
  initialError,
}: {
  personId: string;
  isMinorPerson: boolean;
  guardians: GuardianRow[];
  wards: GuardianRow[];
  isOwner: boolean;
  initialError?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [shownGuardians, removeOptimistically] = useOptimistic(
    guardians,
    (current, removedId: string) =>
      current.filter((guardian) => guardian.id !== removedId),
  );
  const [error, setError] = useState<string | null>(initialError ?? null);

  function handleRemove(guardianId: string) {
    startTransition(async () => {
      removeOptimistically(guardianId);
      const result = await removeGuardian(personId, guardianId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
    });
  }

  const showGuardians = isMinorPerson || guardians.length > 0;
  const showWards = !isMinorPerson && wards.length > 0;
  if (!showGuardians && !showWards && !error) return null;

  return (
    <Card className="flex flex-col gap-4" data-testid="guardians-section">
      {showGuardians && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink-900">Tutores</h2>
            {isMinorPerson && <AddGuardian minorId={personId} />}
          </div>
          {shownGuardians.length === 0 ? (
            <p className="text-sm text-ink-800">No tiene tutor/a.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {shownGuardians.map((guardian) => (
                <li
                  key={guardian.id}
                  data-testid="guardian-row"
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
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
                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={pending}
                      data-testid="guardian-remove"
                      onClick={() => handleRemove(guardian.id)}
                    >
                      Quitar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {showWards && (
        <>
          <h2 className="text-lg font-bold text-ink-900">Menores a su cargo</h2>
          <ul className="flex flex-col divide-y divide-line">
            {wards.map((ward) => (
              <li
                key={ward.id}
                data-testid="ward-row"
                className="py-2 text-[15px] text-ink-900"
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
