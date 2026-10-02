import { madridDateTime } from "@clinicalumia/api/madrid-time";
import { Badge } from "@clinicalumia/ui/badge";
import { CircleCheck, Euro, UserX } from "lucide-react";
import type { Block, ScheduleBlock, SpecialtyTone } from "@/lib/agenda";
import type { Closure } from "@/lib/closures";
import type { AgendaPaymentIcon, AgendaPaymentState } from "@/lib/payments";
import { DrawerLink } from "../url-drawer";
import type { AgendaAppointment } from "./load";

export const PX_PER_MINUTE = 2;
export const SLOT_MINUTES = 15;
export const HEADER_HEIGHT = 64;
export const CLOSURE_BAND_HEIGHT = 44;

export const TONE_CLASSES: Record<SpecialtyTone, string> = {
  sage: "border-sage-400 bg-sage-100 text-sage-900",
  bark: "border-[#b5a2b0] bg-[#ece4ea] text-bark-700",
  pebble: "border-[#9ea3b5] bg-[#e4e6ee] text-pebble-700",
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
  status?: AgendaAppointment["status"];
  toneClass: string;
  webBooking?: boolean;
  paymentIcon?: AgendaPaymentIcon | null;
};

const PAYMENT_ICONS: Record<AgendaPaymentState, typeof CircleCheck> = {
  paid: CircleCheck,
  pending: Euro,
  no_show: UserX,
};

const PAYMENT_ICON_TONES: Record<AgendaPaymentState, string> = {
  paid: "",
  pending: "text-warning-800",
  no_show: "",
};

function BlockTitle({
  title,
  paymentIcon,
  className,
}: {
  title: string;
  paymentIcon?: AgendaPaymentIcon | null;
  className: string;
}) {
  if (!paymentIcon) return <p className={className}>{title}</p>;
  const Icon = PAYMENT_ICONS[paymentIcon.state];
  return (
    <p className={`flex items-center gap-1 ${className}`}>
      <span
        data-testid="appointment-payment-icon"
        data-state={paymentIcon.state}
        title={paymentIcon.label}
        className={`shrink-0 ${PAYMENT_ICON_TONES[paymentIcon.state]}`}
      >
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">{paymentIcon.label}</span>
      </span>
      <span className="truncate">{title}</span>
    </p>
  );
}

export type PositionedBlock = {
  id: string;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  content: BlockContent;
};

export function ClosureBand({
  closure,
  className = "",
}: {
  closure: Closure;
  className?: string;
}) {
  const text = `Clínica cerrada · ${closure.reason}`;
  return (
    <p
      data-testid="agenda-closure"
      title={text}
      className={`border-warning-800/25 bg-warning-100 px-3 font-semibold text-[13px] text-warning-800 ${className}`}
    >
      {text}
    </p>
  );
}

export function AgendaColumnGrid({
  windowMinutes,
  firstHour,
  schedule,
  items,
  closed = false,
  clickable = false,
  onClick,
  onKeyDown,
}: {
  windowMinutes: number;
  firstHour: number;
  schedule: ScheduleBlock[];
  items: PositionedBlock[];
  closed?: boolean;
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
      {closed && (
        <div className="pointer-events-none absolute inset-0 bg-warning-100/60" />
      )}
      {items.map((item) => {
        const { content } = item;
        const blockStyle = {
          top: item.top * PX_PER_MINUTE,
          height: item.height * PX_PER_MINUTE,
          ...(item.lanes > 1 && {
            left: `calc(${(item.lane * 100) / item.lanes}% + 4px)`,
            width: `calc(${100 / item.lanes}% - 8px)`,
          }),
        };
        const className = `absolute inset-x-1 overflow-hidden rounded-field border border-l-3 px-2 py-1.5 text-xs ${content.toneClass} ${content.status === "no_show" ? "border-l-warning-800" : ""} ${content.testId === "time-off-block" ? "border-dashed" : ""}`;
        if (content.href) {
          return (
            <DrawerLink
              key={item.id}
              href={content.href}
              data-testid={content.testId}
              data-appointment={content.block.id}
              data-status={content.status}
              className={className}
              style={blockStyle}
            >
              {content.webBooking && (
                <Badge
                  tone="neutral"
                  data-testid="web-booking-badge"
                  className="px-1.5 py-0.5 text-[10px]"
                >
                  Reserva web
                </Badge>
              )}
              <BlockTitle
                title={content.title}
                paymentIcon={content.paymentIcon}
                className="truncate font-medium"
              />
              <p className="truncate">{content.subtitle}</p>
            </DrawerLink>
          );
        }
        return (
          <div
            key={item.id}
            data-testid={content.testId}
            className={className}
            style={blockStyle}
          >
            {content.webBooking && (
              <Badge
                tone="neutral"
                data-testid="web-booking-badge"
                className="px-1.5 py-0.5 text-[10px]"
              >
                Reserva web
              </Badge>
            )}
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
          <DrawerLink
            key={content.block.id}
            href={content.href}
            data-testid={content.testId}
            data-appointment={content.block.id}
            data-status={content.status}
            className={`rounded-field border border-l-3 px-3 py-2 text-sm ${content.toneClass} ${content.status === "no_show" ? "border-l-warning-800" : ""}`}
          >
            {content.webBooking && (
              <Badge tone="neutral" data-testid="web-booking-badge">
                Reserva web
              </Badge>
            )}
            <BlockTitle
              title={content.title}
              paymentIcon={content.paymentIcon}
              className="font-medium"
            />
            <p className="text-xs">{content.subtitle}</p>
          </DrawerLink>
        ) : (
          <div
            key={content.block.id}
            data-testid={content.testId}
            className={`rounded-field border border-l-3 px-3 py-2 text-sm ${content.toneClass}`}
          >
            {content.webBooking && (
              <Badge tone="neutral" data-testid="web-booking-badge">
                Reserva web
              </Badge>
            )}
            <p className="font-medium">{content.title}</p>
            <p className="text-xs">{content.subtitle}</p>
          </div>
        ),
      )}
    </div>
  );
}
