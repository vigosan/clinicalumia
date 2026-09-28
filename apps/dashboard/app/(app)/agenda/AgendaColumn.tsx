import { madridDateTime } from "@clinicalumia/api/madrid-time";
import Link from "next/link";
import type { Block, ScheduleBlock, SpecialtyTone } from "@/lib/agenda";

export const PX_PER_MINUTE = 2;
export const SLOT_MINUTES = 15;
export const HEADER_HEIGHT = 64;

export const TONE_CLASSES: Record<SpecialtyTone, string> = {
  sage: "border-sage-400 bg-sage-100 text-sage-900",
  bark: "border-bark-100 bg-bark-100 text-bark-700",
  pebble: "border-pebble-400 bg-pebble-200 text-pebble-700",
  neutral: "border-line bg-cream-200 text-ink-900",
};

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function timeOf(instant: string): string {
  return madridDateTime(instant).time.slice(0, 5);
}

export function timeToMinutes(time: string): number {
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

export function outOfScheduleBands(
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

export function buildHref(
  base: string,
  params: Record<string, string | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export type BlockContent = {
  block: Block;
  testId: "appointment-block" | "busy-block" | "time-off-block";
  title: string;
  subtitle: string;
  href?: string;
  dimmed: boolean;
  toneClass: string;
};

export type PositionedBlock = {
  id: string;
  top: number;
  height: number;
  content: BlockContent;
};

export function AgendaColumnGrid({
  windowMinutes,
  firstHour,
  schedule,
  items,
  clickable = false,
  onClick,
  onKeyDown,
}: {
  windowMinutes: number;
  firstHour: number;
  schedule: ScheduleBlock[];
  items: PositionedBlock[];
  clickable?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const clickableProps: React.ComponentProps<"div"> = clickable
    ? { role: "button", tabIndex: 0, onClick, onKeyDown }
    : {};
  return (
    <div
      className="relative"
      style={{
        height: windowMinutes * PX_PER_MINUTE,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent ${SLOT_MINUTES * PX_PER_MINUTE}px)`,
        cursor: clickable ? "pointer" : "default",
      }}
      {...clickableProps}
    >
      {outOfScheduleBands(schedule, firstHour, windowMinutes).map((band) => (
        <div
          key={band.top}
          className="pointer-events-none absolute inset-x-0 bg-ink-900/5"
          style={{
            top: band.top * PX_PER_MINUTE,
            height: band.height * PX_PER_MINUTE,
          }}
        />
      ))}
      {items.map((item) => {
        const { content } = item;
        const blockStyle = {
          top: item.top * PX_PER_MINUTE,
          height: item.height * PX_PER_MINUTE,
        };
        const className = `absolute inset-x-1 overflow-hidden rounded-field border px-2 py-1.5 text-xs ${content.toneClass} ${content.dimmed ? "opacity-60" : ""} ${content.testId === "time-off-block" ? "border-dashed" : ""}`;
        if (content.href) {
          return (
            <Link
              key={item.id}
              href={content.href}
              data-testid={content.testId}
              data-appointment={content.block.id}
              className={className}
              style={blockStyle}
            >
              <p className="truncate font-medium">{content.title}</p>
              <p className="truncate">{content.subtitle}</p>
            </Link>
          );
        }
        return (
          <div
            key={item.id}
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
  );
}

export function AgendaColumnList({ items }: { items: BlockContent[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && <p className="text-ink-700 text-sm">Sin citas.</p>}
      {items.map((content) =>
        content.href ? (
          <Link
            key={content.block.id}
            href={content.href}
            data-testid={content.testId}
            data-appointment={content.block.id}
            className={`rounded-field border px-3 py-2 text-sm ${content.toneClass} ${content.dimmed ? "opacity-60" : ""}`}
          >
            <p className="font-medium">{content.title}</p>
            <p className="text-xs">{content.subtitle}</p>
          </Link>
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
  );
}
