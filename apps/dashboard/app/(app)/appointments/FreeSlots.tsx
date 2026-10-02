"use client";

import { useEffect, useState } from "react";
import { loadFreeSlots } from "./actions";

export function FreeSlots({
  professionalId,
  date,
  duration,
  value,
  onSelect,
}: {
  professionalId: string;
  date: string;
  duration: string;
  value: string;
  onSelect: (time: string) => void;
}) {
  const [result, setResult] = useState<{
    key: string;
    slots: string[] | null;
  } | null>(null);
  const minutes = Number(duration);
  const ready =
    Boolean(professionalId && date) &&
    Number.isInteger(minutes) &&
    minutes >= 5 &&
    minutes <= 480 &&
    minutes % 5 === 0;
  const key = `${professionalId}|${date}|${minutes}`;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    loadFreeSlots(professionalId, date, minutes)
      .catch(() => null)
      .then((slots) => {
        if (active) setResult({ key, slots });
      });
    return () => {
      active = false;
    };
  }, [ready, key, professionalId, date, minutes]);

  if (!ready) return null;

  const current = result?.key === key ? result : null;

  return (
    <fieldset
      aria-label="Huecos libres"
      aria-busy={!current}
      data-testid="appointment-free-slots"
      className="-mt-2 flex flex-wrap gap-2"
    >
      {!current ? (
        <p className="text-[13px] text-ink-700">Buscando huecos libres…</p>
      ) : current.slots === null ? (
        <p className="text-[13px] text-ink-700">
          No se han podido cargar los huecos libres.
        </p>
      ) : current.slots.length === 0 ? (
        <p className="text-[13px] text-ink-700">
          No hay huecos libres ese día para esa duración.
        </p>
      ) : (
        current.slots.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={slot === value}
            onClick={() => onSelect(slot)}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-line px-3 text-[13px] text-ink-900 tabular-nums transition-colors duration-150 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 aria-pressed:border-sage-800 aria-pressed:bg-sage-100 aria-pressed:font-medium"
          >
            {slot}
          </button>
        ))
      )}
    </fieldset>
  );
}
