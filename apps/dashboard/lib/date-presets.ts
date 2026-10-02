import {
  addDays,
  monthEnd,
  todayInMadrid,
  weekStart,
} from "@clinicalumia/api/madrid-time";
import type { RangePreset } from "@clinicalumia/ui/date-range-picker";

export function madridRangePresets(now: Date = new Date()): RangePreset[] {
  const today = todayInMadrid(now);
  const yesterday = addDays(today, -1);
  const monday = weekStart(today);
  return [
    { key: "hoy", label: "Hoy", from: today, to: today },
    { key: "ayer", label: "Ayer", from: yesterday, to: yesterday },
    {
      key: "semana",
      label: "Esta semana",
      from: monday,
      to: addDays(monday, 6),
    },
    {
      key: "mes",
      label: "Este mes",
      from: `${today.slice(0, 7)}-01`,
      to: monthEnd(today),
    },
  ];
}
