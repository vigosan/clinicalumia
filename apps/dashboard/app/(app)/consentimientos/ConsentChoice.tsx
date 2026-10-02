import { Badge } from "@clinicalumia/ui/badge";
import { Check, X } from "lucide-react";

export function ConsentChoice({
  label,
  granted,
}: {
  label: string;
  granted: boolean;
}) {
  const Icon = granted ? Check : X;
  return (
    <Badge
      tone={granted ? "success" : "neutral"}
      className="gap-1"
      data-testid="consent-choice"
      data-granted={granted}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
      <span className="sr-only">: {granted ? "Sí" : "No"}</span>
    </Badge>
  );
}
