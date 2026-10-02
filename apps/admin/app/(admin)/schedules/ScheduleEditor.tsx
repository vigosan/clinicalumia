"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { TimeSelect } from "@clinicalumia/ui/time-select";
import { useState, useTransition } from "react";
import {
  type ScheduleBlock,
  type ScheduleSource,
  WEEKDAYS,
} from "@/lib/schedule";
import { saveSchedule } from "./actions";

type Row = { key: string; starts_at: string; ends_at: string };

function toRows(blocks: ScheduleBlock[]) {
  const rows: Record<number, Row[]> = {};
  for (let day = 1; day <= 7; day++) rows[day] = [];
  const ordered = [...blocks].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  for (const block of ordered) {
    const list = rows[block.weekday] ?? [];
    list.push({
      key: crypto.randomUUID(),
      starts_at: block.starts_at.slice(0, 5),
      ends_at: block.ends_at.slice(0, 5),
    });
    rows[block.weekday] = list;
  }
  return rows;
}

export function ScheduleEditor({
  profileId,
  blocks,
  sources,
}: {
  profileId: string;
  blocks: ScheduleBlock[];
  sources: ScheduleSource[];
}) {
  const [rows, setRows] = useState(() => toRows(blocks));
  const [sourceId, setSourceId] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ error: string } | { ok: true } | null>(
    null,
  );

  const update = (day: number, next: Row[]) => {
    setStatus(null);
    setRows((current) => ({ ...current, [day]: next }));
  };

  const source = sources.find((item) => item.id === sourceId);
  const hasRows = Object.values(rows).some((list) => list.length > 0);
  const copy = () => {
    if (!source) return;
    setStatus(null);
    setRows(toRows(source.blocks));
  };
  const copyButton = (
    <Button
      type="button"
      variant="secondary"
      disabled={!source}
      data-testid="schedule-copy-apply"
      onClick={hasRows ? undefined : copy}
    >
      Copiar
    </Button>
  );

  return (
    <Card className="flex flex-col gap-4">
      {sources.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-72">
            <Field label="Copiar horario de">
              <Select
                data-testid="schedule-copy"
                value={sourceId}
                onValueChange={setSourceId}
                placeholder="Elige a una persona"
                options={sources.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Field>
          </div>
          {hasRows ? (
            <ConfirmDialog
              trigger={copyButton}
              title="¿Sustituir el horario?"
              description={`Los tramos que hay ahora se cambiarán por los de ${source?.name ?? ""}. No se guarda hasta que pulses «Guardar horario».`}
              confirmLabel="Sustituir"
              onConfirm={copy}
            />
          ) : (
            copyButton
          )}
        </div>
      )}
      <div className="flex flex-col divide-y divide-line">
        {WEEKDAYS.map((label, index) => {
          const day = index + 1;
          const dayRows = rows[day] ?? [];
          return (
            <div
              key={label}
              data-testid={`schedule-day-${day}`}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start"
            >
              <span className="w-28 shrink-0 pt-2.5 text-[15px] font-medium text-ink-900">
                {label}
              </span>
              <div className="flex flex-1 flex-col gap-2">
                {dayRows.length === 0 && (
                  <span className="pt-2.5 text-sm text-ink-800">
                    Sin horario
                  </span>
                )}
                {dayRows.map((row, position) => (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <TimeSelect
                      aria-label={`${label}, inicio del tramo ${position + 1}`}
                      data-testid="schedule-start"
                      className="w-32"
                      value={row.starts_at}
                      onValueChange={(next) =>
                        update(
                          day,
                          dayRows.map((r) =>
                            r.key === row.key ? { ...r, starts_at: next } : r,
                          ),
                        )
                      }
                    />
                    <span className="text-ink-800">a</span>
                    <TimeSelect
                      aria-label={`${label}, fin del tramo ${position + 1}`}
                      data-testid="schedule-end"
                      className="w-32"
                      value={row.ends_at}
                      onValueChange={(next) =>
                        update(
                          day,
                          dayRows.map((r) =>
                            r.key === row.key ? { ...r, ends_at: next } : r,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="schedule-remove"
                      aria-label={`Quitar tramo ${position + 1} del ${label.toLowerCase()}`}
                      onClick={() =>
                        update(
                          day,
                          dayRows.filter((r) => r.key !== row.key),
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid={`schedule-add-${day}`}
                onClick={() =>
                  update(day, [
                    ...dayRows,
                    { key: crypto.randomUUID(), starts_at: "", ends_at: "" },
                  ])
                }
              >
                Añadir tramo
              </Button>
            </div>
          );
        })}
      </div>
      {status && "error" in status && (
        <p
          role="alert"
          data-testid="schedule-error"
          className="text-[13px] text-danger-600"
        >
          {status.error}
        </p>
      )}
      {status && "ok" in status && (
        <p
          role="status"
          data-testid="schedule-saved"
          className="text-[13px] text-sage-900"
        >
          Horario guardado.
        </p>
      )}
      <div>
        <Button
          type="button"
          disabled={pending}
          data-testid="schedule-save"
          onClick={() =>
            startTransition(async () => {
              const blocks = Object.entries(rows).flatMap(([day, list]) =>
                list.map((row) => ({
                  weekday: Number(day),
                  starts_at: row.starts_at,
                  ends_at: row.ends_at,
                })),
              );
              const result = await saveSchedule(profileId, blocks);
              setStatus(result);
              if ("ok" in result) setRows(toRows(blocks));
            })
          }
        >
          {pending ? "Guardando…" : "Guardar horario"}
        </Button>
      </div>
    </Card>
  );
}
