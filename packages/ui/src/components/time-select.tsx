"use client";

import { Check, Clock } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { popoverPanel } from "./calendar";
import { fieldControl } from "./input";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const SLOTS = Array.from(
  { length: 96 },
  (_, index) => `${pad(Math.floor(index / 4))}:${pad((index % 4) * 15)}`,
);

export function parseTime(text: string): string | null {
  const match = /^(\d{1,2})(?:[:.,h]?(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

function slotFor(text: string): number | null {
  const time = parseTime(text);
  if (time) {
    const index = SLOTS.findIndex((slot) => slot >= time);
    return index === -1 ? SLOTS.length - 1 : index;
  }
  const typed = text.trim();
  if (!typed) return null;
  const index = SLOTS.findIndex(
    (slot) => slot.startsWith(typed) || slot.startsWith(`0${typed}`),
  );
  return index === -1 ? null : index;
}

export function TimeSelect({
  value,
  defaultValue = "",
  onValueChange,
  name,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-testid": testId,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = value ?? uncontrolled;
  const [text, setText] = useState(current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [navigated, setNavigated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef<number | null>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    setText(current);
  }, [current]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    function handleReset() {
      setUncontrolled(defaultValue);
      setText(value ?? defaultValue);
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue, value]);

  function scrollToActive(list: HTMLDivElement | null) {
    if (!list || active === null || scrolledRef.current === active) return;
    const option = list.children[active] as HTMLElement | undefined;
    if (!option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (scrolledRef.current === null)
      list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
    scrolledRef.current = active;
  }

  useEffect(() => {
    if (!open) scrolledRef.current = null;
    else scrollToActive(listRef.current);
  });

  function openList() {
    setOpen(true);
    setNavigated(false);
    setActive(slotFor(current));
  }

  function commit(next: string | null) {
    setOpen(false);
    if (next === null || next === current) {
      setText(current);
      return;
    }
    setText(next);
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  }

  function move(step: number) {
    setNavigated(true);
    setActive((index) =>
      index === null
        ? (slotFor(current) ?? 0)
        : Math.min(SLOTS.length - 1, Math.max(0, index + step)),
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape") {
      setText(current);
      return;
    }
    if (event.key !== "Enter") return;
    if (open) {
      event.preventDefault();
      const highlighted = active === null ? null : (SLOTS[active] ?? null);
      commit(navigated ? highlighted : (parseTime(text) ?? highlighted));
      return;
    }
    if (text !== current) {
      event.preventDefault();
      commit(parseTime(text));
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}
    >
      <Popover.Anchor asChild>
        <div ref={anchorRef} className={cn("relative", className)}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="hh:mm"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && active !== null ? optionId(active) : undefined
            }
            data-testid={testId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setOpen(true);
              setNavigated(false);
              setActive(slotFor(event.target.value));
            }}
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={handleKeyDown}
            onBlur={() => commit(parseTime(text))}
            className={cn(fieldControl, "pr-9 tabular-nums")}
          />
          <Clock
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-700"
          />
          {name && <input type="hidden" name={name} value={current} />}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node))
              event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            popoverPanel,
            "w-(--radix-popover-trigger-width) min-w-32 p-1.5",
          )}
        >
          <div
            ref={(node) => {
              listRef.current = node;
              scrollToActive(node);
            }}
            role="listbox"
            id={listId}
            aria-label="Horas"
            className="relative max-h-60 overflow-y-auto"
          >
            {SLOTS.map((slot, index) => (
              <div
                key={slot}
                id={optionId(index)}
                role="option"
                aria-selected={slot === current}
                data-highlighted={index === active ? "" : undefined}
                onMouseMove={() => {
                  setActive(index);
                  setNavigated(true);
                }}
                tabIndex={-1}
                onPointerUp={() => commit(slot)}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pr-9 pl-3 text-[15px] tabular-nums aria-selected:font-medium data-[highlighted]:bg-sage-100"
              >
                {slot}
                {slot === current && (
                  <Check
                    aria-hidden="true"
                    strokeWidth={2.5}
                    className="absolute right-3 size-4 text-sage-800"
                  />
                )}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
