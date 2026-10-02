import {
  addDays,
  todayInMadrid,
  weekStart,
} from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { weekTitle } from "@/lib/agenda";

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

function titleFor(date: string, view: string): string {
  if (view === "week") {
    const start = weekStart(date);
    return weekTitle(start, addDays(start, 6));
  }
  const formatted = new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function AgendaHeader({
  date,
  view,
  withParam,
  personParam,
  dayToWeekPerson,
  isOwner,
  selfId,
}: {
  date: string;
  view: string;
  withParam: string;
  personParam: string;
  dayToWeekPerson: string;
  isOwner: boolean;
  selfId: string;
}) {
  const today = todayInMadrid();
  const step = view === "week" ? 7 : 1;
  const weekToDayWith = isOwner && personParam ? personParam : undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-3">
      <Link
        href={buildHref("/", {
          date: addDays(date, -step),
          view,
          with: view === "day" ? withParam : undefined,
          person: view === "week" ? personParam : undefined,
        })}
        data-testid="agenda-prev"
        aria-label={view === "week" ? "Semana anterior" : "Día anterior"}
        className="order-2 flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200 sm:order-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href={buildHref("/", {
          date: addDays(date, step),
          view,
          with: view === "day" ? withParam : undefined,
          person: view === "week" ? personParam : undefined,
        })}
        data-testid="agenda-next"
        aria-label={view === "week" ? "Semana siguiente" : "Día siguiente"}
        className="order-2 flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200 sm:order-none"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
      <div className="order-1 flex basis-full flex-col sm:order-none sm:mr-auto sm:basis-auto xl:min-w-0 xl:flex-1 xl:basis-0">
        <p className={eyebrowClass}>Agenda</p>
        <h1
          data-testid="agenda-title"
          className="text-balance font-bold text-[1.75rem] text-ink-900 leading-tight tracking-[-0.01em] sm:text-title"
        >
          {titleFor(date, view)}
        </h1>
      </div>
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none sm:gap-3">
        <Button
          asChild
          variant="secondary"
          size="sm"
          data-testid="agenda-today"
        >
          <Link
            href={buildHref("/", {
              date: today,
              view,
              with: view === "day" ? withParam : undefined,
              person: view === "week" ? personParam : undefined,
            })}
          >
            Hoy
          </Link>
        </Button>
        <div className="flex overflow-hidden rounded-full border border-line">
          <Link
            href={buildHref("/", {
              date,
              view: "day",
              with: view === "day" ? withParam : weekToDayWith,
            })}
            data-testid="agenda-view-day"
            aria-current={view === "day" ? "page" : undefined}
            className={`px-4 py-2 text-sm ${view === "day" ? "bg-sage-800 text-cream-50" : "text-ink-900"}`}
          >
            Día
          </Link>
          <Link
            href={buildHref("/", {
              date,
              view: "week",
              person:
                view === "week" ? personParam : dayToWeekPerson || undefined,
            })}
            data-testid="agenda-view-week"
            aria-current={view === "week" ? "page" : undefined}
            className={`px-4 py-2 text-sm ${view === "week" ? "bg-sage-800 text-cream-50" : "text-ink-900"}`}
          >
            Semana
          </Link>
        </div>
        <Button
          asChild
          size="sm"
          data-testid="agenda-new"
          className="max-sm:size-9 max-sm:px-0"
        >
          <Link
            href={buildHref("/", {
              date,
              view: view === "week" ? view : undefined,
              with: view === "day" ? withParam : undefined,
              person: view === "week" ? personParam : undefined,
              new: "1",
              professional: isOwner ? undefined : selfId,
            })}
          >
            <Plus aria-hidden="true" />
            <span className="max-sm:sr-only">Nueva cita</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
