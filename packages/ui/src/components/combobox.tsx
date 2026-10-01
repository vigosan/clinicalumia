"use client";

import { Command } from "cmdk";
import { Plus, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";
import { Label } from "./label";

export type ComboboxStatus = "idle" | "loading" | "ready" | "error";

export type ComboboxAction = { label: string; onSelect: () => void };

const ACTION_VALUE = "__action__";
const NOTHING = "__nothing__";

const optionClass =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[15px] text-ink-900 outline-none transition-colors data-[selected=true]:bg-sage-100";

const messageClass = "px-3 py-2.5 text-sm text-ink-800";

export function Combobox<T>({
  label,
  placeholder,
  query,
  onQueryChange,
  items,
  getKey,
  renderItem,
  onSelect,
  status,
  emptyText,
  errorText = "No se ha podido buscar. Inténtalo de nuevo.",
  action,
  "data-testid": testId,
  optionTestId,
}: {
  label: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  status: ComboboxStatus;
  emptyText: string;
  errorText?: string;
  action?: ComboboxAction;
  "data-testid"?: string;
  optionTestId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputId, setInputId] = useState<string>();
  const [highlighted, setHighlighted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const actionChosenRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim() !== "";
  const visible = open && (hasQuery || action !== undefined);
  const shownItems = hasQuery && status === "ready" ? items : [];
  const firstValue = shownItems[0] ? getKey(shownItems[0]) : "";
  const showAction =
    action !== undefined && !(hasQuery && status === "loading");

  useEffect(() => {
    setInputId(inputRef.current?.id);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute("aria-expanded", String(visible));
    const active = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [],
    ).find((option) => option.dataset.value === highlighted);
    if (visible && active) {
      input.setAttribute("aria-activedescendant", active.id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  });

  useEffect(() => {
    actionChosenRef.current = false;
    setHighlighted(visible ? firstValue : "");
  }, [visible, firstValue]);

  function choose(item: T) {
    setOpen(false);
    onSelect(item);
  }

  return (
    <Command
      label={label}
      shouldFilter={false}
      vimBindings={false}
      value={highlighted}
      onValueChange={(next) => {
        if (next === ACTION_VALUE && !actionChosenRef.current) {
          setHighlighted((current) => (current === NOTHING ? "" : NOTHING));
          return;
        }
        setHighlighted(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          actionChosenRef.current = true;
        }
      }}
      className="flex flex-col gap-1.5"
    >
      <Label htmlFor={inputId} aria-hidden="true">
        {label}
      </Label>
      <Popover.Root open={visible} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div ref={anchorRef} className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-500"
            />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={(next) => {
                actionChosenRef.current = false;
                onQueryChange(next);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Home" || event.key === "End") {
                  event.stopPropagation();
                }
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              placeholder={placeholder}
              data-testid={testId}
              className={cn(fieldControl, "pl-10")}
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (anchorRef.current?.contains(event.target as Node)) {
                event.preventDefault();
              }
            }}
            onMouseDown={(event) => event.preventDefault()}
            className="z-50 w-(--radix-popover-trigger-width) min-w-64 overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.25)] data-[state=open]:animate-pop-in motion-reduce:animate-none"
          >
            {hasQuery && status === "loading" && (
              <p role="status" className={messageClass}>
                Buscando…
              </p>
            )}
            {hasQuery && status === "error" && (
              <p
                role="alert"
                data-testid={testId && `${testId}-error`}
                className={cn(messageClass, "text-danger-600")}
              >
                {errorText}
              </p>
            )}
            {hasQuery && status === "ready" && items.length === 0 && (
              <p
                role="status"
                data-testid={testId && `${testId}-empty`}
                className={messageClass}
              >
                {emptyText}
              </p>
            )}
            <Command.List
              ref={listRef}
              label="Resultados"
              className="max-h-72 overflow-y-auto"
            >
              {shownItems.map((item) => (
                <Command.Item
                  key={getKey(item)}
                  value={getKey(item)}
                  onSelect={() => choose(item)}
                  data-testid={optionTestId}
                  className={optionClass}
                >
                  {renderItem(item)}
                </Command.Item>
              ))}
              {showAction && hasQuery && (
                <Command.Separator
                  alwaysRender
                  className="-mx-1.5 my-1.5 h-px bg-line"
                />
              )}
              {action && showAction && (
                <Command.Item
                  value={ACTION_VALUE}
                  onPointerMove={() => {
                    actionChosenRef.current = true;
                  }}
                  onSelect={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                  className={cn(optionClass, "font-medium text-sage-800")}
                >
                  <Plus aria-hidden="true" className="size-4 shrink-0" />
                  {action.label}
                </Command.Item>
              )}
            </Command.List>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Command>
  );
}

export type PersonComboboxItem = {
  id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  phone: string | null;
};

export function PersonCombobox<T extends PersonComboboxItem>({
  search,
  ...props
}: {
  label: string;
  placeholder?: string;
  search: (query: string) => Promise<T[]>;
  onSelect: (person: T) => void;
  emptyText: string;
  action?: ComboboxAction;
  "data-testid"?: string;
  optionTestId?: string;
}) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<T[]>([]);
  const [status, setStatus] = useState<ComboboxStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++searchSeqRef.current;
    if (!value.trim()) {
      setPeople([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    debounceRef.current = setTimeout(() => {
      void search(value)
        .then((found) => {
          if (searchSeqRef.current !== seq) return;
          setPeople(found);
          setStatus("ready");
        })
        .catch(() => {
          if (searchSeqRef.current !== seq) return;
          setPeople([]);
          setStatus("error");
        });
    }, 300);
  }

  return (
    <Combobox
      {...props}
      query={query}
      onQueryChange={handleQueryChange}
      items={people}
      status={status}
      getKey={(person) => person.id}
      renderItem={(person) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {person.first_name} {person.last_name}
          </span>
          <span className="truncate text-[13px] text-ink-700">
            {[person.age === null ? null : `${person.age} años`, person.phone]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      )}
    />
  );
}
