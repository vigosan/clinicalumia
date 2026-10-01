"use client";

import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { useState } from "react";
import { durationOptions, OTHER_DURATION } from "@/lib/duration";

export function DurationField({
  value,
  onValueChange,
  testId,
}: {
  value: string;
  onValueChange: (value: string) => void;
  testId: string;
}) {
  const [custom, setCustom] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Field label="Duración">
        <Select
          data-testid={testId}
          placeholder="Según el servicio"
          value={custom ? OTHER_DURATION : value}
          onValueChange={(next) => {
            setCustom(next === OTHER_DURATION);
            if (next !== OTHER_DURATION) onValueChange(next);
          }}
          options={durationOptions(value)}
        />
      </Field>
      {custom ? (
        <Input
          name="duration_minutes"
          type="number"
          step={5}
          min={5}
          max={480}
          placeholder="Minutos"
          aria-label="Duración en minutos"
          data-testid={`${testId}-minutes`}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      ) : (
        <input type="hidden" name="duration_minutes" value={value} />
      )}
    </div>
  );
}
