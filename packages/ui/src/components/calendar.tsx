"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";

export function isoToDate(iso: string): Date {
  return new Date(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

export function dateToIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDay(iso: string, pattern: string): string {
  return format(isoToDate(iso), pattern, { locale: es });
}

export const pickerTrigger =
  "flex cursor-pointer items-center justify-between gap-2 text-left focus:border-line-field focus:ring-0 focus-visible:border-sage-800 focus-visible:ring-[3px] focus-visible:ring-sage-800/15 data-[placeholder]:text-ink-500 data-[state=open]:border-sage-800 data-[state=open]:ring-[3px] data-[state=open]:ring-sage-800/15";

export const popoverPanel =
  "z-50 rounded-xl border border-line bg-surface text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.25)] outline-none data-[state=open]:animate-pop-in motion-reduce:animate-none";

const navButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-800 outline-none transition-colors hover:bg-cream-200 focus-visible:ring-[3px] focus-visible:ring-sage-800/25";

export function Calendar(props: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={es}
      weekStartsOn={1}
      showOutsideDays
      navLayout="around"
      classNames={{
        root: "p-3",
        months: "flex",
        month: "grid grid-cols-[auto_1fr_auto] items-center gap-y-2",
        month_caption: "flex h-8 items-center justify-center",
        caption_label:
          "text-[15px] font-medium text-ink-900 first-letter:uppercase",
        button_previous: navButton,
        button_next: navButton,
        chevron: "size-4",
        month_grid: "col-span-3 border-collapse",
        weekday:
          "size-10 pb-1 text-[12px] font-medium text-ink-700 first-letter:uppercase",
        week: "",
        day: "group/day size-10 p-0.5 text-center",
        day_button:
          "size-9 cursor-pointer rounded-full text-[14px] text-ink-900 tabular-nums outline-none transition-colors hover:bg-sage-100 focus-visible:ring-[3px] focus-visible:ring-sage-800/30 disabled:cursor-not-allowed",
        today:
          "[&>button]:font-semibold [&>button]:text-sage-800 [&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4",
        selected:
          "[&>button]:bg-sage-800 [&>button]:text-white [&>button]:hover:bg-sage-900",
        outside: "[&>button]:text-ink-500",
        disabled: "[&>button]:opacity-40",
        range_start: "rounded-l-full bg-sage-100",
        range_end: "rounded-r-full bg-sage-100",
        range_middle:
          "bg-sage-100 [&>button]:bg-transparent! [&>button]:text-ink-900! [&>button]:hover:bg-sage-300!",
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft aria-hidden="true" className="size-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
