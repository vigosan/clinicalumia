"use client";

import { cn } from "@clinicalumia/ui/cn";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  type Closure,
  closureLabel,
  closuresInMonth,
  formatDay,
  monthGrid,
  monthLabel,
  shiftMonth,
} from "@/lib/closures";
import { ClosureDrawer } from "./ClosureDrawer";

const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

const navLinkClass =
  "inline-flex h-9 items-center justify-center rounded-full border border-line bg-white px-3 text-sm font-medium text-ink-900 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-sage-800";

type Selection = { closure: Closure } | { day: string } | null;

export function ClosuresCalendar({
  month,
  closures,
  today,
}: {
  month: string;
  closures: Closure[];
  today: string;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const close = useCallback(() => setSelection(null), []);
  const weeks = monthGrid(month, closures);
  const listed = closuresInMonth(closures, month);

  return (
    <div className="flex flex-col gap-4">
      <div
        data-testid="closures-month"
        data-month={month}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h2 className="text-xl font-bold text-ink-900">{monthLabel(month)}</h2>
        <div className="flex gap-2">
          <Link
            href={`/closures?month=${shiftMonth(month, -1)}`}
            aria-label="Mes anterior"
            className={navLinkClass}
          >
            ‹
          </Link>
          <Link
            href={`/closures?month=${today.slice(0, 7)}`}
            className={navLinkClass}
          >
            Hoy
          </Link>
          <Link
            href={`/closures?month=${shiftMonth(month, 1)}`}
            aria-label="Mes siguiente"
            className={navLinkClass}
          >
            ›
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-line">
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAY_INITIALS.map((initial) => (
            <div
              key={initial}
              aria-hidden="true"
              className="bg-cream-50 py-2 text-center text-xs font-medium text-ink-700"
            >
              {initial}
            </div>
          ))}
          {weeks.flat().map((cell) => (
            <button
              key={cell.date}
              type="button"
              data-testid={`closure-day-${cell.date}`}
              data-closed={cell.closure ? "true" : "false"}
              aria-label={
                cell.closure
                  ? `${formatDay(cell.date)}, cerrado: ${cell.closure.reason}`
                  : formatDay(cell.date)
              }
              onClick={() =>
                setSelection(
                  cell.closure ? { closure: cell.closure } : { day: cell.date },
                )
              }
              className={cn(
                "flex min-h-14 cursor-pointer flex-col items-start gap-1 p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sage-800 focus-visible:ring-inset sm:min-h-24 sm:p-2",
                cell.closure
                  ? "bg-warning-100 text-warning-800 hover:bg-warning-100/70"
                  : "bg-surface hover:bg-sage-100",
                !cell.inMonth && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums",
                  cell.date === today && "bg-sage-800 font-semibold text-white",
                )}
              >
                {Number(cell.date.slice(8, 10))}
              </span>
              {cell.closure && (
                <span className="hidden w-full truncate text-xs font-medium sm:block">
                  {cell.closure.reason}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {listed.length > 0 && (
        <ul className="flex flex-col gap-2 sm:hidden">
          {listed.map((closure) => (
            <li key={closure.id}>
              <button
                type="button"
                data-testid="closure-month-item"
                onClick={() => setSelection({ closure })}
                className="w-full cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 text-left text-[15px] text-ink-900 hover:bg-sage-100"
              >
                {closureLabel(closure)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ClosureDrawer
        open={selection !== null}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        closure={
          selection && "closure" in selection ? selection.closure : undefined
        }
        day={selection && "day" in selection ? selection.day : undefined}
        today={today}
        onDone={close}
      />
    </div>
  );
}
