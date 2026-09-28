import {
  addDays,
  todayInMadrid,
  weekStart,
} from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          href={buildHref("/", {
            date: addDays(date, -step),
            view,
            with: view === "day" ? withParam : undefined,
            person: view === "week" ? personParam : undefined,
          })}
          data-testid="agenda-prev"
          aria-label={view === "week" ? "Semana anterior" : "Día anterior"}
          className="flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200"
        >
          ‹
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
          className="flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200"
        >
          ›
        </Link>
        <h1
          data-testid="agenda-title"
          className="font-bold text-title text-ink-900"
        >
          {titleFor(date, view)}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={buildHref("/", {
            date: today,
            view,
            with: view === "day" ? withParam : undefined,
            person: view === "week" ? personParam : undefined,
          })}
          data-testid="agenda-today"
        >
          <Button variant="secondary" size="sm">
            Hoy
          </Button>
        </Link>
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
        <Link
          href={buildHref("/appointments/new", {
            date,
            professional: isOwner ? undefined : selfId,
          })}
          data-testid="agenda-new"
        >
          <Button size="sm">+ Nueva cita</Button>
        </Link>
      </div>
    </div>
  );
}
