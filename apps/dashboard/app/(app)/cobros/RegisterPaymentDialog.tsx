"use client";

import { Button } from "@clinicalumia/ui/button";
import { Dialog } from "@clinicalumia/ui/dialog";
import { fieldControl } from "@clinicalumia/ui/input";
import { Label } from "@clinicalumia/ui/label";
import { toast } from "@clinicalumia/ui/toast";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactElement, useId, useRef, useState } from "react";
import {
  candidateMoment,
  filterPaymentCandidates,
  groupPaymentCandidates,
  type PaymentCandidate,
  paymentToastMessage,
} from "@/lib/payment-candidates";
import { formatEuros, type PaymentMethod, parseAmount } from "@/lib/payments";
import { PENDING_WINDOW_DAYS } from "@/lib/pending-payments";
import { PaymentForm } from "../agenda/PaymentForm";

const groupTitleClass =
  "px-1 pb-1 text-xs font-medium text-ink-700 uppercase tracking-[0.08em]";

function focusFirstInput(container: HTMLElement | null) {
  container?.querySelector<HTMLInputElement>("input")?.focus();
}

function CandidateGroup({
  title,
  testId,
  candidates,
  now,
  onPick,
  onKeyDown,
}: {
  title: string;
  testId: string;
  candidates: PaymentCandidate[];
  now: Date;
  onPick: (candidate: PaymentCandidate) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const titleId = useId();
  if (candidates.length === 0) return null;
  return (
    <div className="flex flex-col" data-testid={testId}>
      <h3 id={titleId} className={groupTitleClass}>
        {title}
      </h3>
      <ul aria-labelledby={titleId} className="flex flex-col gap-1">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              data-testid="payment-candidate"
              data-candidate
              onClick={() => onPick(candidate)}
              onKeyDown={onKeyDown}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[15px] text-ink-900 outline-none transition-colors hover:bg-sage-100 focus-visible:bg-sage-100 focus-visible:ring-2 focus-visible:ring-sage-800"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {candidate.patientName}
                </span>
                <span className="truncate text-[13px] text-ink-700">
                  {candidateMoment(candidate.startsAt, now)} ·{" "}
                  {candidate.serviceName} · {candidate.professionalName}
                </span>
              </span>
              <span className="shrink-0 text-sm text-ink-800 tabular-nums">
                {formatEuros(candidate.suggestedAmountCents)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterPaymentDialog({
  trigger,
  now,
  candidates = [],
  loadError = false,
  preselected,
  focusAfterSuccess,
}: {
  trigger: ReactElement;
  now: string;
  candidates?: PaymentCandidate[];
  loadError?: boolean;
  preselected?: PaymentCandidate;
  focusAfterSuccess?: string;
}) {
  const router = useRouter();
  const searchId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const staleRef = useRef(false);
  const succeededRef = useRef(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PaymentCandidate | null>(
    preselected ?? null,
  );
  const nowDate = new Date(now);

  function goTo(candidate: PaymentCandidate | null) {
    setSelected(candidate);
    requestAnimationFrame(() => focusFirstInput(bodyRef.current));
  }

  function handleOpenChange(next: boolean) {
    if (!next && submitting) return;
    setOpen(next);
    if (next) {
      setQuery("");
      setSelected(preselected ?? null);
      succeededRef.current = false;
    } else if (staleRef.current) {
      staleRef.current = false;
      router.refresh();
    }
  }

  function handleSuccess({
    amount,
    method,
  }: {
    amount: string;
    method: PaymentMethod;
  }) {
    const parsed = parseAmount(amount);
    succeededRef.current = true;
    staleRef.current = false;
    setSubmitting(false);
    setOpen(false);
    toast(paymentToastMessage("cents" in parsed ? parsed.cents : 0, method));
    router.refresh();
  }

  function moveFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(
      bodyRef.current?.querySelectorAll<HTMLElement>("[data-candidate]") ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next =
      current === -1
        ? event.key === "ArrowDown"
          ? 0
          : items.length - 1
        : Math.min(Math.max(current + step, 0), items.length - 1);
    items[next]?.focus();
  }

  const visible = filterPaymentCandidates(candidates, query);
  const groups = groupPaymentCandidates(visible, nowDate);

  return (
    <Dialog
      trigger={trigger}
      open={open}
      onOpenChange={handleOpenChange}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        focusFirstInput(bodyRef.current);
      }}
      onCloseAutoFocus={(event) => {
        if (!succeededRef.current || !focusAfterSuccess) return;
        event.preventDefault();
        document.querySelector<HTMLElement>(focusAfterSuccess)?.focus();
      }}
      title="Registrar cobro"
      description={
        selected
          ? "Si hay importe, al registrar el cobro se emite la factura simplificada."
          : "Elige la cita que quieres cobrar."
      }
      data-testid="payment-register-dialog"
    >
      <div ref={bodyRef} className="flex flex-col gap-4">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <div
                className="flex min-w-0 flex-col"
                data-testid="payment-selected"
              >
                <span className="truncate font-medium text-ink-900">
                  {selected.patientName}
                </span>
                <span className="text-[13px] text-ink-700">
                  {candidateMoment(selected.startsAt, nowDate)} ·{" "}
                  {selected.serviceName} · {selected.professionalName}
                </span>
              </div>
              {!preselected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="payment-change-appointment"
                  onClick={() => goTo(null)}
                >
                  <ArrowLeft aria-hidden="true" />
                  Cambiar cita
                </Button>
              )}
            </div>
            <PaymentForm
              key={selected.id}
              appointmentId={selected.id}
              suggestedAmountCents={selected.suggestedAmountCents}
              cancelled={false}
              initiallyOpen
              onSuccess={handleSuccess}
              onError={() => {
                staleRef.current = true;
              }}
              onPendingChange={setSubmitting}
            />
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={searchId}>Paciente</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-500"
                />
                <input
                  id={searchId}
                  type="search"
                  autoComplete="off"
                  placeholder="Buscar por nombre"
                  data-testid="payment-candidate-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={moveFocus}
                  className={`${fieldControl} pl-10`}
                />
              </div>
            </div>
            {loadError ? (
              <p
                role="alert"
                data-testid="payment-candidates-error"
                className="text-[13px] text-danger-600"
              >
                No se han podido cargar las citas. Recarga la página.
              </p>
            ) : visible.length === 0 ? (
              <p
                role="status"
                data-testid="payment-candidates-empty"
                className="px-1 text-sm text-ink-800"
              >
                {query.trim()
                  ? "No hay citas por cobrar de ningún paciente con ese nombre."
                  : `No hay citas por cobrar hoy ni pendientes en los últimos ${PENDING_WINDOW_DAYS} días.`}
              </p>
            ) : (
              <div className="-mx-1 flex max-h-[min(24rem,50dvh)] flex-col gap-4 overflow-y-auto px-1">
                <CandidateGroup
                  title="Hoy"
                  testId="payment-candidates-today"
                  candidates={groups.today}
                  now={nowDate}
                  onPick={goTo}
                  onKeyDown={moveFocus}
                />
                <CandidateGroup
                  title="Pendientes de días anteriores"
                  testId="payment-candidates-earlier"
                  candidates={groups.earlier}
                  now={nowDate}
                  onPick={goTo}
                  onKeyDown={moveFocus}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
