"use client";

import { CalendarDays } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
  Calendar,
  dateToIso,
  formatDay,
  isoToDate,
  pickerTrigger,
  popoverPanel,
} from "./calendar";
import { fieldControl } from "./input";

export function DatePicker({
  value,
  defaultValue = "",
  onValueChange,
  today,
  name,
  placeholder = "Elige una fecha",
  required,
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
  today: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const messageId = useId();
  const [missing, setMissing] = useState(false);
  const current = value ?? uncontrolled;
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const form = triggerRef.current?.form;
    if (!form) return;
    function handleReset() {
      setUncontrolled(defaultValue);
      setMissing(false);
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  function choose(next: string) {
    setOpen(false);
    setMissing(false);
    if (next === current) return;
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={contentId}
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-required={required}
            aria-invalid={ariaInvalid || missing || undefined}
            aria-describedby={
              [ariaDescribedBy, missing && messageId]
                .filter(Boolean)
                .join(" ") || undefined
            }
            data-testid={testId}
            data-placeholder={current ? undefined : ""}
            className={cn(fieldControl, pickerTrigger, className)}
          >
            <span className="truncate">
              {current ? formatDay(current, "EEE, d MMM yyyy") : placeholder}
            </span>
            <CalendarDays
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-700"
            />
          </button>
        </Popover.Trigger>
        {name && (
          <input
            type={required ? "text" : "hidden"}
            name={name}
            value={current}
            required={required}
            tabIndex={-1}
            aria-hidden="true"
            onChange={() => {}}
            onInvalid={(event) => {
              event.preventDefault();
              setMissing(true);
              const firstInvalid =
                event.currentTarget.form?.querySelector(":invalid");
              if (firstInvalid === event.currentTarget)
                triggerRef.current?.focus();
            }}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
          />
        )}
        {missing && (
          <p
            id={messageId}
            role="alert"
            className="mt-1.5 text-[13px] text-danger-600"
          >
            Elige una fecha
          </p>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          id={contentId}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={popoverPanel}
        >
          <Calendar
            mode="single"
            autoFocus
            required
            selected={current ? isoToDate(current) : undefined}
            defaultMonth={isoToDate(current || today)}
            today={isoToDate(today)}
            onSelect={(date) => choose(dateToIso(date))}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
