import Link from "next/link";
import { type Block, layoutDay, specialtyTone } from "@/lib/agenda";
import {
  AgendaColumnGrid,
  AgendaColumnList,
  type BlockContent,
  buildHref,
  HEADER_HEIGHT,
  type PositionedBlock,
  PX_PER_MINUTE,
  pad,
  TONE_CLASSES,
  timeOf,
} from "./AgendaColumn";
import type { AgendaColumn, WeekDayData } from "./load";

function weekdayLabel(date: string): string {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function dayLabel(date: string): string {
  return pad(Number(date.slice(8, 10)));
}

function buildDayBlocks(
  day: WeekDayData,
  toneClass: string,
  anchorDate: string,
  personId: string,
) {
  const blocks: Block[] = [];
  const contentById = new Map<string, BlockContent>();

  for (const appointment of day.appointments) {
    const block: Block = {
      id: appointment.id,
      kind: "own",
      professionalId: appointment.professionalId,
      start: appointment.startsAt,
      end: appointment.endsAt,
    };
    blocks.push(block);
    contentById.set(block.id, {
      block,
      testId: "appointment-block",
      title: appointment.patientName,
      subtitle: `${timeOf(appointment.startsAt)} · ${appointment.serviceName}`,
      href: buildHref("/", {
        date: anchorDate,
        view: "week",
        person: personId,
        appointment: appointment.id,
      }),
      dimmed: appointment.status === "no_show",
      toneClass,
      webBooking: appointment.origin === "web",
    });
  }

  for (const entry of day.timeOff) {
    const block: Block = {
      id: entry.id,
      kind: "time_off",
      professionalId: entry.professionalId,
      start: entry.startsAt,
      end: entry.endsAt,
    };
    blocks.push(block);
    contentById.set(block.id, {
      block,
      testId: "time-off-block",
      title: "Ausencia",
      subtitle: entry.reason
        ? `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)} · ${entry.reason}`
        : `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)}`,
      dimmed: false,
      toneClass: "border-line bg-cream-100",
    });
  }

  return { blocks, contentById };
}

export function WeekView({
  date,
  isOwner,
  personId,
  personName,
  personSpecialtySlug,
  candidates,
  days,
  firstHour,
  lastHour,
}: {
  date: string;
  isOwner: boolean;
  personId: string;
  personName: string;
  personSpecialtySlug: string | null;
  candidates: AgendaColumn[];
  days: WeekDayData[];
  firstHour: number;
  lastHour: number;
}) {
  const windowMinutes = (lastHour - firstHour) * 60;
  const toneClass = TONE_CLASSES[specialtyTone(personSpecialtySlug ?? "")];
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, index) => firstHour + index,
  );

  const itemsByDay = days.map((day) => {
    const { blocks, contentById } = buildDayBlocks(
      day,
      toneClass,
      date,
      personId,
    );
    const laidOut = layoutDay(blocks, day.date, firstHour, lastHour);
    const items: PositionedBlock[] = laidOut
      .map((entry) => {
        const content = contentById.get(entry.id);
        if (!content) return null;
        return { id: entry.id, top: entry.top, height: entry.height, content };
      })
      .filter((item): item is PositionedBlock => item !== null);
    return { day, items };
  });

  return (
    <div className="flex flex-col gap-4">
      {isOwner && candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-ink-900">Ver la semana de</span>
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={buildHref("/", {
                date,
                view: "week",
                person: candidate.id,
              })}
              data-testid="week-person"
              data-person={candidate.id}
              aria-current={candidate.id === personId ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${
                candidate.id === personId
                  ? "border-sage-800 bg-sage-800 text-cream-50"
                  : "border-line text-ink-900"
              }`}
            >
              {candidate.fullName}
            </Link>
          ))}
        </div>
      )}
      <p className="text-ink-700 text-sm">{personName}</p>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface sm:block">
        <div className="relative flex min-w-max">
          <div className="w-16 shrink-0 border-line border-r">
            <div style={{ height: HEADER_HEIGHT }} />
            <div
              className="relative"
              style={{ height: windowMinutes * PX_PER_MINUTE }}
            >
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="-translate-y-1/2 absolute right-2 text-ink-700 text-xs"
                  style={{ top: (hour - firstHour) * 60 * PX_PER_MINUTE }}
                >
                  {pad(hour)}:00
                </span>
              ))}
            </div>
          </div>
          {itemsByDay.map(({ day, items }) => (
            <div
              key={day.date}
              data-testid="week-day"
              data-date={day.date}
              className="w-40 shrink-0 border-line border-r last:border-r-0"
            >
              <div
                className="flex flex-col justify-center gap-0.5 border-line border-b px-2"
                style={{ height: HEADER_HEIGHT }}
              >
                <p className="truncate font-medium text-ink-900 text-sm">
                  {weekdayLabel(day.date)}
                </p>
                <p className="truncate text-ink-700 text-xs">
                  {dayLabel(day.date)}
                </p>
              </div>
              <AgendaColumnGrid
                windowMinutes={windowMinutes}
                firstHour={firstHour}
                schedule={day.schedule}
                items={items}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6 sm:hidden">
        {itemsByDay.map(({ day, items }) => {
          const sorted = items
            .map((item) => item.content)
            .sort(
              (a, b) =>
                new Date(a.block.start).getTime() -
                new Date(b.block.start).getTime(),
            );
          return (
            <div key={day.date} data-testid="week-day" data-date={day.date}>
              <p className="font-medium text-ink-900">
                {weekdayLabel(day.date)} {dayLabel(day.date)}
              </p>
              <div className="mt-2">
                <AgendaColumnList items={sorted} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
