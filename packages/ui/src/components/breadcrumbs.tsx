import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const parent = items.findLast((item) => item.href);
  return (
    <nav aria-label="Migas de pan" className="text-sm">
      <ol
        data-testid="breadcrumbs"
        className="hidden flex-wrap items-center gap-1.5 text-ink-700 sm:flex"
      >
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${item.href ?? ""}`}>
            {index > 0 && (
              <li aria-hidden="true" className="text-ink-400">
                <ChevronRight className="size-3.5" />
              </li>
            )}
            <li className="min-w-0">
              {item.href ? (
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors hover:text-ink-900 hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-ink-900">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
      {parent?.href && (
        <Link
          href={parent.href}
          data-testid="breadcrumbs-back"
          className="-ml-1 inline-flex max-w-full items-center gap-0.5 rounded-sm text-ink-700 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-sage-800 sm:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{parent.label}</span>
        </Link>
      )}
    </nav>
  );
}
