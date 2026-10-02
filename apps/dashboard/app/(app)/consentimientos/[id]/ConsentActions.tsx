"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { toast } from "@clinicalumia/ui/toast";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { ConsentFillField, ConsentFillOffer } from "@/lib/consents";
import {
  type PatientOption,
  PatientPicker,
} from "../../appointments/PatientPicker";
import { consentFillOptions, linkConsent, unlinkConsent } from "../actions";

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
  const [offers, setOffers] = useState<ConsentFillOffer[]>([]);
  const [fill, setFill] = useState<ConsentFillField[]>([]);
  const requested = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  function handleSelect(patient: PatientOption) {
    setSelected(patient);
    setOffers([]);
    setFill([]);
    requested.current = patient.id;
    startTransition(async () => {
      const options = await consentFillOptions(consentId, patient.id);
      if (requested.current !== patient.id) return;
      setOffers(options);
      setFill(options.map((offer) => offer.field));
    });
  }

  function handleClear() {
    requested.current = null;
    setSelected(null);
    setOffers([]);
    setFill([]);
  }

  function toggleFill(field: ConsentFillField, checked: boolean) {
    setFill((current) =>
      checked
        ? [...current, field]
        : current.filter((candidate) => candidate !== field),
    );
  }

  function handleLink() {
    if (!selected) return;
    startTransition(async () => {
      const result = await linkConsent(consentId, selected.id, fill);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      handleClear();
      setError(null);
      toast("Consentimiento asociado");
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkConsent(consentId);
      setError("error" in result ? result.error : null);
      if (!("error" in result)) toast("Consentimiento desasociado");
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
              onSelect={handleSelect}
              onClear={handleClear}
              hideNewPerson
            />
          </div>
          {offers.length > 0 && (
            <fieldset
              data-testid="consent-fill"
              className="flex flex-col gap-2"
            >
              <legend className="mb-1 text-[15px] font-medium text-ink-900">
                Completar la ficha con los datos del consentimiento
              </legend>
              {offers.map((offer) => (
                <CheckboxField
                  key={offer.field}
                  label={`${offer.label}: ${offer.value}`}
                  checked={fill.includes(offer.field)}
                  onChange={(event) =>
                    toggleFill(offer.field, event.target.checked)
                  }
                  data-testid={`consent-fill-${offer.field}`}
                />
              ))}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              size="sm"
              disabled={!selected || pending}
              data-testid="consent-link"
              onClick={handleLink}
            >
              {pending ? "Asociando…" : "Asociar a esta ficha"}
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
