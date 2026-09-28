import { Button } from "@clinicalumia/ui/button";
import { wardsLabel } from "@/lib/ward-label";
import type { Duplicate } from "./actions";

export function DuplicateWarning({
  duplicates,
  onUseExisting,
  onContinue,
}: {
  duplicates: Duplicate[];
  onUseExisting: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="duplicate-warning"
      className="flex flex-col gap-3 rounded-card border border-warning-800 bg-warning-100 p-4"
    >
      <p className="text-[15px] font-medium text-ink-900">
        Puede que esta persona ya exista.
      </p>
      <ul className="flex flex-col gap-2">
        {duplicates.map((duplicate) => (
          <li
            key={duplicate.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-[15px] text-ink-900">
              {duplicate.first_name} {duplicate.last_name}
              {duplicate.wards.length > 0 &&
                ` · ${wardsLabel(duplicate.wards)}`}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              data-testid="duplicate-use"
              onClick={() => onUseExisting(duplicate.id)}
            >
              Usar esta persona
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="duplicate-continue"
          onClick={onContinue}
        >
          Es otra persona, continuar
        </Button>
      </div>
    </div>
  );
}
