import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

export const eyebrowClass =
  "text-xs font-medium text-ink-700 uppercase tracking-[0.08em]";

export function PageHeader({
  eyebrow,
  title,
  titleTestId,
  description,
  actions,
  breadcrumbs,
}: {
  eyebrow?: string;
  title: string;
  titleTestId?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {breadcrumbs && (
        <div className="mb-1.5">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
      {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            data-testid={titleTestId}
            className="min-w-0 break-words text-title font-bold text-ink-900"
          >
            {title}
          </h1>
          {description && (
            <p className="max-w-[70ch] text-[15px] text-ink-800">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2.5 sm:mt-0.5">{actions}</div>}
      </div>
    </div>
  );
}
