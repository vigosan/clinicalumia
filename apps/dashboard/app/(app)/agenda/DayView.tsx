"use client";

import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type Block,
  layoutDay,
  type ScheduleBlock,
  specialtyTone,
} from "@/lib/agenda";
import type { Closure } from "@/lib/closures";
import {
  AgendaColumnGrid,
  AgendaColumnList,
  type BlockContent,
  buildHref,
  ClosureBand,
  HEADER_HEIGHT,
  type PositionedBlock,
  PX_PER_MINUTE,
  pad,
  SLOT_MINUTES,
  TONE_CLASSES,
  timeOf,
} from "./AgendaColumn";
import type {
  AgendaAppointment,
  AgendaBusy,
  AgendaColumn,
  AgendaTimeOff,
} from "./load";

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
      noShow: appointment.status === "no_show",
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
      webBooking: appointment.origin === "web",
      paymentIcon: appointment.paymentIcon,
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

function useNowOffset(date: string, firstHour: number, windowMinutes: number) {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      if (date !== todayInMadrid()) {
        setOffset(null);
        return;
      }
      const { time } = madridDateTime(new Date());
      const minutes =
        Number(time.slice(0, 2)) * 60 +
        Number(time.slice(3, 5)) -
        firstHour * 60;
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
  closure,
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
  closure: Closure | null;
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
  const laidOutByColumn = new Map<string, PositionedBlock[]>();
  for (const entry of laidOut) {
    const content = contentById.get(entry.id);
    if (!content) continue;
    const list = laidOutByColumn.get(content.block.professionalId) ?? [];
    list.push({
      id: entry.id,
      top: entry.top,
      height: entry.height,
      lane: entry.lane,
      lanes: entry.lanes,
      content,
    });
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
      {closure && (
        <ClosureBand
          closure={closure}
          className="truncate rounded-card border py-2.5"
        />
      )}
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
                    {column.inactive && (
                      <span data-testid="agenda-column-inactive">
                        Inactiva ·{" "}
                      </span>
                    )}
                    {column.specialtyName ?? "Sin especialidad"}
                  </p>
                </div>
                <AgendaColumnGrid
                  windowMinutes={windowMinutes}
                  firstHour={firstHour}
                  schedule={schedulesByColumn[column.id] ?? []}
                  items={laidOutByColumn.get(column.id) ?? []}
                  closed={closure !== null}
                  clickable={isSelfColumn}
                  onClick={(event) => handleColumnClick(event, column.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    router.push(
                      buildHref("/appointments/new", {
                        date,
                        professional: selfId,
                      }),
                    );
                  }}
                />
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
            .map((entry) => entry.content)
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
                {column.inactive && (
                  <span data-testid="agenda-column-inactive">Inactiva · </span>
                )}
                {column.specialtyName ?? "Sin especialidad"}
              </p>
              <AgendaColumnList items={items} />
            </div>
          );
        })}
      </div>
    </>
  );
}
