"use client";

import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  type PatientOption,
  PatientPicker,
} from "../../appointments/PatientPicker";
import { linkConsent, unlinkConsent } from "../actions";

export function ConsentActions({
  consentId,
  linked,
  initialError,
}: {
  consentId: string;
  linked: boolean;
  initialError?: string;
}) {
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  function handleLink() {
    if (!selected) return;
    startTransition(async () => {
      const result = await linkConsent(consentId, selected.id);
      setSelected(null);
      setError("error" in result ? result.error : null);
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkConsent(consentId);
      setError("error" in result ? result.error : null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {linked ? (
        <div>
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                data-testid="consent-unlink"
              >
                Desasociar
              </Button>
            }
            title="¿Desasociar este consentimiento?"
            description="Quedará pendiente de asociar. Podrás asociarlo de nuevo cuando quieras."
            confirmLabel="Desasociar"
            onConfirm={handleUnlink}
          />
        </div>
      ) : (
        <>
          <div data-testid="consent-link-picker">
            <PatientPicker
              selected={selected}
              onSelect={setSelected}
              onClear={() => setSelected(null)}
              hideNewPerson
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              size="sm"
              disabled={!selected || pending}
              data-testid="consent-link"
              onClick={handleLink}
            >
              {pending ? "Asociando…" : "Asociar"}
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/patients/new?consentimiento=${consentId}`}
                data-testid="consent-create-person"
              >
                Crear ficha con estos datos
              </Link>
            </Button>
          </div>
        </>
      )}
      {error && (
        <p
          role="alert"
          data-testid="consent-action-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
