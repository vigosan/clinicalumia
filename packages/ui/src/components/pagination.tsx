import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "./button";

export function Pagination({
  page,
  pageCount,
  hrefFor,
  testIdPrefix,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  testIdPrefix: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-2 text-sm text-ink-800"
    >
      {page > 1 ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={hrefFor(page - 1)} data-testid={`${testIdPrefix}-prev`}>
            <ChevronLeft aria-hidden="true" className="-ml-1" />
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="tabular-nums">
        Página {page} de {pageCount}
      </span>
      {page < pageCount ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={hrefFor(page + 1)} data-testid={`${testIdPrefix}-next`}>
            Siguiente
            <ChevronRight aria-hidden="true" className="-mr-1" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
