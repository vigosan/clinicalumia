import type { Ward } from "@/lib/ward-label";

export const RELATIONSHIP_OPTIONS: {
  value: Ward["relationship"];
  label: string;
}[] = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "tutor_legal", label: "Tutor legal" },
  { value: "otro", label: "Otro" },
];

export const RELATIONSHIP_LABEL: Record<Ward["relationship"], string> = {
  madre: "Madre",
  padre: "Padre",
  tutor_legal: "Tutor legal",
  otro: "Otro",
};
