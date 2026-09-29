"use client";

import Link from "next/link";
import { useState } from "react";

export type PickerSlot = { startsAt: string; time: string; href: string };

export type PickerDay = {
  date: string;
  label: string;
  morning: PickerSlot[];
  afternoon: PickerSlot[];
};

function SlotGroup({
  title,
  date,
  slots,
}: {
  title: string;
  date: string;
  slots: PickerSlot[];
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <h3 className="font-bold text-ink-600">{title}</h3>
      <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {slots.map((slot) => (
          <li key={slot.startsAt}>
            <Link
              href={slot.href}
              data-testid="booking-slot"
              data-date={date}
              className="flex h-11 items-center justify-center rounded-full border-2 border-sage-500 text-ink-600 transition-colors hover:bg-sage-500 hover:text-cream-50"
            >
              {slot.time}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SlotPicker({ days }: { days: PickerDay[] }) {
  const [selected, setSelected] = useState(days[0]?.date);
  const day = days.find((candidate) => candidate.date === selected) ?? days[0];
  if (!day) return null;

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {days.map((candidate) => (
          <li key={candidate.date}>
            <button
              type="button"
              data-testid="booking-day"
              aria-pressed={candidate.date === day.date}
              onClick={() => setSelected(candidate.date)}
              className="w-full cursor-pointer rounded-2xl border-2 border-sage-500 px-3 py-2 text-left text-ink-600 text-sm transition-colors hover:bg-sage-500/15 aria-pressed:bg-sage-500 aria-pressed:text-cream-50"
            >
              {candidate.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-6">
        <SlotGroup title="Por la mañana" date={day.date} slots={day.morning} />
        <SlotGroup title="Por la tarde" date={day.date} slots={day.afternoon} />
      </div>
    </div>
  );
}
