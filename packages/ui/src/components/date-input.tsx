"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

function toDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function mask(text: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return toDisplay(text);
  const parts = text.split("/");
  const digits = parts
    .map((part, index) => {
      const partDigits = part.replace(/\D/g, "");
      return index < 2 && index < parts.length - 1 && partDigits.length === 1
        ? `0${partDigits}`
        : partDigits;
    })
    .join("")
    .slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toIso(display: string, min: string, max?: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const iso = `${year}-${month}-${day}`;
  if (date.toISOString().slice(0, 10) !== iso) return null;
  if (iso < min || (max && iso > max)) return null;
  return iso;
}

const INVALID_MESSAGE = "Fecha no válida. Escríbela como 05/03/1990.";

export function DateInput({
  name,
  defaultValue = "",
  min = "1900-01-01",
  max,
  id,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-testid": testId,
  onBlur,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
  onBlur?: () => void;
}) {
  const [text, setText] = useState(toDisplay(defaultValue));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const iso = toIso(text, min, max);
  const invalid = text !== "" && iso === null;
  const showError = touched && invalid;
  const messageId = useId();

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? INVALID_MESSAGE : "");
  }, [invalid]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    function handleReset() {
      setText(toDisplay(defaultValue));
      setTouched(false);
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        id={id}
        aria-invalid={ariaInvalid || showError || undefined}
        aria-describedby={
          [ariaDescribedBy, showError && messageId].filter(Boolean).join(" ") ||
          undefined
        }
        data-testid={testId}
        value={text}
        onChange={(event) => setText(mask(event.target.value))}
        onBlur={() => {
          setTouched(true);
          onBlur?.();
        }}
        className={cn(fieldControl, "tabular-nums", className)}
      />
      {showError && (
        <p id={messageId} role="alert" className="text-[13px] text-danger-600">
          {INVALID_MESSAGE}
        </p>
      )}
      <input type="hidden" name={name} value={iso ?? ""} />
    </>
  );
}
