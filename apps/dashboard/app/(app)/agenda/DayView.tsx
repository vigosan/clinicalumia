"use client";

import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type Block,
  layoutDay,
  type ScheduleBlock,
  type SpecialtyTone,
  specialtyTone,
} from "@/lib/agenda";
import type {
  AgendaAppointment,
  AgendaBusy,
  AgendaColumn,
  AgendaTimeOff,
} from "./load";

const PX_PER_MINUTE = 2;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 64;

const TONE_CLASSES: Record<SpecialtyTone, string> = {
  sage: "border-sage-400 bg-sage-100 text-sage-900",
  bark: "border-bark-100 bg-bark-100 text-bark-700",
  pebble: "border-pebble-400 bg-pebble-200 text-pebble-700",
  neutral: "border-line bg-cream-200 text-ink-900",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function timeOf(instant: string): string {
  return madridDateTime(instant).time.slice(0, 5);
}

function timeToMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function scheduleBands(
  schedules: ScheduleBlock[],
  firstHour: number,
): [number, number][] {
  return schedules
    .map(
      (block) =>
        [
          timeToMinutes(block.starts_at) - firstHour * 60,
          timeToMinutes(block.ends_at) - firstHour * 60,
        ] as [number, number],
    )
    .sort((a, b) => a[0] - b[0]);
}

function outOfScheduleBands(
  schedules: ScheduleBlock[],
  firstHour: number,
  windowMinutes: number,
): { top: number; height: number }[] {
  const bands = scheduleBands(schedules, firstHour);
  const gaps: { top: number; height: number }[] = [];
  let cursor = 0;
  for (const [start, end] of bands) {
    const clampedStart = Math.max(0, Math.min(start, windowMinutes));
    if (clampedStart > cursor) {
      gaps.push({ top: cursor, height: clampedStart - cursor });
    }
    cursor = Math.max(cursor, Math.min(end, windowMinutes));
  }
  if (cursor < windowMinutes) {
    gaps.push({ top: cursor, height: windowMinutes - cursor });
  }
  return gaps;
}

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

type BlockContent = {
  block: Block;
  testId: "appointment-block" | "busy-block" | "time-off-block";
  title: string;
  subtitle: string;
  href?: string;
  dimmed: boolean;
  toneClass: string;
};

function buildBlockContents(
  columns: AgendaColumn[],
  appointments: AgendaAppointment[],
  busy: AgendaBusy[],
  timeOff: AgendaTimeOff[],
  date: string,
  view: string,
  withParam: string,
): { blocks: Block[]; contentById: Map<string, BlockContent> } {
  const toneByColumn = new Map(
    columns.map((column) => [
      column.id,
      TONE_CLASSES[specialtyTone(column.specialtySlug ?? "")],
    ]),
  );
  const blocks: Block[] = [];
  const contentById = new Map<string, BlockContent>();

  for (const appointment of appointments) {
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
        date,
        view,
        with: withParam,
        appointment: appointment.id,
      }),
      dimmed: appointment.status === "no_show",
      toneClass:
        toneByColumn.get(appointment.professionalId) ?? TONE_CLASSES.neutral,
    });
  }

  busy.forEach((entry, index) => {
    const id = `busy-${entry.professionalId}-${index}`;
    const block: Block = {
      id,
      kind: "busy",
      professionalId: entry.professionalId,
      start: entry.startsAt,
      end: entry.endsAt,
    };
    blocks.push(block);
    contentById.set(id, {
      block,
      testId: "busy-block",
      title: "Ocupado",
      subtitle: `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)}`,
      dimmed: false,
      toneClass: TONE_CLASSES.neutral,
    });
  });

  for (const entry of timeOff) {
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
      title: "No disponible",
      subtitle: entry.reason
        ? `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)} · ${entry.reason}`
        : `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)}`,
      dimmed: false,
      toneClass: "border-line bg-cream-100",
    });
  }

  return { blocks, contentById };
}

function useNowOffset(date: string, firstHour: number, windowMinutes: number) {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      if (date !== todayInMadrid()) {
        setOffset(null);
        return;
      }
      const { time } = madridDateTime(new Date());
      const minutes = timeToMinutes(time.slice(0, 5)) - firstHour * 60;
      if (minutes < 0 || minutes > windowMinutes) {
        setOffset(null);
        return;
      }
      setOffset(minutes);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [date, firstHour, windowMinutes]);

  return offset;
}

export function DayView({
  date,
  view,
  withParam,
  selfId,
  columns,
  appointments,
  busy,
  timeOff,
  schedulesByColumn,
  firstHour,
  lastHour,
}: {
  date: string;
  view: string;
  withParam: string;
  selfId: string;
  columns: AgendaColumn[];
  appointments: AgendaAppointment[];
  busy: AgendaBusy[];
  timeOff: AgendaTimeOff[];
  schedulesByColumn: Record<string, ScheduleBlock[]>;
  firstHour: number;
  lastHour: number;
}) {
  const router = useRouter();
  const windowMinutes = (lastHour - firstHour) * 60;
  const { blocks, contentById } = buildBlockContents(
    columns,
    appointments,
    busy,
    timeOff,
    date,
    view,
    withParam,
  );
  const laidOut = layoutDay(blocks, date, firstHour, lastHour);
  const laidOutByColumn = new Map<string, typeof laidOut>();
  for (const entry of laidOut) {
    const content = contentById.get(entry.id);
    if (!content) continue;
    const list = laidOutByColumn.get(content.block.professionalId) ?? [];
    list.push(entry);
    laidOutByColumn.set(content.block.professionalId, list);
  }
  const nowOffset = useNowOffset(date, firstHour, windowMinutes);
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, index) => firstHour + index,
  );

  function handleColumnClick(
    event: React.MouseEvent<HTMLDivElement>,
    columnId: string,
  ) {
    if (columnId !== selfId) return;
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.floor((event.clientY - rect.top) / PX_PER_MINUTE);
    const snapped = Math.max(
      0,
      Math.min(
        windowMinutes - SLOT_MINUTES,
        Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES,
      ),
    );
    const hour = firstHour + Math.floor(snapped / 60);
    const minute = snapped % 60;
    const time = `${pad(hour)}:${pad(minute)}`;
    router.push(
      buildHref("/appointments/new", { date, time, professional: selfId }),
    );
  }

  return (
    <>
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
          {columns.map((column) => {
            const isSelfColumn = column.id === selfId;
            const columnBodyProps: React.ComponentProps<"div"> = isSelfColumn
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: (event) => handleColumnClick(event, column.id),
                  onKeyDown: (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    router.push(
                      buildHref("/appointments/new", {
                        date,
                        professional: selfId,
                      }),
                    );
                  },
                }
              : {};
            return (
              <div
                key={column.id}
                data-testid="agenda-column"
                data-professional={column.id}
                className="w-45 shrink-0 border-line border-r last:border-r-0"
              >
                <div
                  className="flex flex-col justify-center gap-0.5 border-line border-b px-2"
                  style={{ height: HEADER_HEIGHT }}
                >
                  <p className="truncate font-medium text-ink-900 text-sm">
                    {column.fullName}
                  </p>
                  <p className="truncate text-ink-700 text-xs">
                    {column.specialtyName ?? "Sin especialidad"}
                  </p>
                </div>
                <div
                  className="relative"
                  style={{
                    height: windowMinutes * PX_PER_MINUTE,
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent ${SLOT_MINUTES * PX_PER_MINUTE}px)`,
                    cursor: isSelfColumn ? "pointer" : "default",
                  }}
                  {...columnBodyProps}
                >
                  {outOfScheduleBands(
                    schedulesByColumn[column.id] ?? [],
                    firstHour,
                    windowMinutes,
                  ).map((band) => (
                    <div
                      key={band.top}
                      className="absolute inset-x-0 bg-ink-900/5"
                      style={{
                        top: band.top * PX_PER_MINUTE,
                        height: band.height * PX_PER_MINUTE,
                      }}
                    />
                  ))}
                  {(laidOutByColumn.get(column.id) ?? []).map((entry) => {
                    const content = contentById.get(entry.id);
                    if (!content) return null;
                    const blockStyle = {
                      top: entry.top * PX_PER_MINUTE,
                      height: entry.height * PX_PER_MINUTE,
                    };
                    const className = `absolute inset-x-1 overflow-hidden rounded-field border px-2 py-1.5 text-xs ${content.toneClass} ${content.dimmed ? "opacity-60" : ""} ${content.testId === "time-off-block" ? "border-dashed" : ""}`;
                    if (content.href) {
                      return (
                        <a
                          key={entry.id}
                          href={content.href}
                          data-testid={content.testId}
                          data-appointment={content.block.id}
                          className={className}
                          style={blockStyle}
                        >
                          <p className="truncate font-medium">
                            {content.title}
                          </p>
                          <p className="truncate">{content.subtitle}</p>
                        </a>
                      );
                    }
                    return (
                      <div
                        key={entry.id}
                        data-testid={content.testId}
                        className={className}
                        style={blockStyle}
                      >
                        <p className="truncate font-medium">{content.title}</p>
                        <p className="truncate">{content.subtitle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {nowOffset !== null && (
            <div
              data-testid="now-line"
              className="pointer-events-none absolute right-0 left-16 z-10 h-[2px] bg-danger-600"
              style={{ top: HEADER_HEIGHT + nowOffset * PX_PER_MINUTE }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-6 sm:hidden">
        {columns.map((column) => {
          const items = (laidOutByColumn.get(column.id) ?? [])
            .map((entry) => contentById.get(entry.id))
            .filter((content): content is BlockContent => Boolean(content))
            .sort(
              (a, b) =>
                new Date(a.block.start).getTime() -
                new Date(b.block.start).getTime(),
            );
          return (
            <div
              key={column.id}
              data-testid="agenda-column"
              data-professional={column.id}
            >
              <p className="font-medium text-ink-900">{column.fullName}</p>
              <p className="mb-2 text-ink-700 text-xs">
                {column.specialtyName ?? "Sin especialidad"}
              </p>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <p className="text-ink-700 text-sm">Sin citas.</p>
                )}
                {items.map((content) =>
                  content.href ? (
                    <a
                      key={content.block.id}
                      href={content.href}
                      data-testid={content.testId}
                      data-appointment={content.block.id}
                      className={`rounded-field border px-3 py-2 text-sm ${content.toneClass} ${content.dimmed ? "opacity-60" : ""}`}
                    >
                      <p className="font-medium">{content.title}</p>
                      <p className="text-xs">{content.subtitle}</p>
                    </a>
                  ) : (
                    <div
                      key={content.block.id}
                      data-testid={content.testId}
                      className={`rounded-field border px-3 py-2 text-sm ${content.toneClass}`}
                    >
                      <p className="font-medium">{content.title}</p>
                      <p className="text-xs">{content.subtitle}</p>
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
