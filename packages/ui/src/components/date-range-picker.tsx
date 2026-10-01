"use client";

import { CalendarRange } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useState } from "react";
import { cn } from "../lib/cn";
import {
  Calendar,
  dateToIso,
  formatDay,
  isoToDate,
  pickerTrigger,
  popoverPanel,
} from "./calendar";
import { fieldControl } from "./input";

export type RangePreset = {
  key: string;
  label: string;
  from: string;
  to: string;
};

export type DateRange = { from: string; to: string };

function rangeLabel({ from, to }: DateRange): string {
  const pattern = "d MMM yyyy";
  return from === to
    ? formatDay(from, pattern)
    : `${formatDay(from, pattern)} – ${formatDay(to, pattern)}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  today,
  presets = [],
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-testid": testId,
}: {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  today: string;
  presets?: RangePreset[];
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const [start, setStart] = useState<string | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    setStart(null);
  }

  function choose(range: DateRange) {
    changeOpen(false);
    if (range.from !== from || range.to !== to) onChange(range);
  }

  function pickDay(day: string) {
    if (start === null) {
      setStart(day);
      return;
    }
    choose(day < start ? { from: day, to: start } : { from: start, to: day });
  }

  const selected =
    start === null
      ? { from: isoToDate(from), to: isoToDate(to) }
      : { from: isoToDate(start), to: undefined };

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={contentId}
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-testid={testId}
          className={cn(fieldControl, pickerTrigger, className)}
        >
          <span className="truncate">{rangeLabel({ from, to })}</span>
          <CalendarRange
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-700"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id={contentId}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={cn(popoverPanel, "flex flex-col sm:flex-row")}
        >
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-line border-b p-3 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
              {presets.map((preset) => {
                const active = preset.from === from && preset.to === to;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    data-testid={testId && `${testId}-preset-${preset.key}`}
                    aria-pressed={active}
                    onClick={() => choose({ from: preset.from, to: preset.to })}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-left text-[14px] text-ink-900 outline-none transition-colors hover:bg-sage-100 focus-visible:ring-[3px] focus-visible:ring-sage-800/25",
                      active && "bg-sage-100 font-medium",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              autoFocus
              selected={selected}
              defaultMonth={isoToDate(from)}
              today={isoToDate(today)}
              onSelect={(_range, day) => pickDay(dateToIso(day))}
            />
            <p
              aria-live="polite"
              className="px-4 pb-3 text-[13px] text-ink-800"
            >
              {start === null ? "Elige el primer día" : "Elige el último día"}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
