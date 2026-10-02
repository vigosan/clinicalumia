import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { PageHeader } from "@clinicalumia/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import { Fragment } from "react";
import { formatCents } from "@/lib/money";
import {
  isCurrentQuarter,
  lastClosedQuarter,
  parseQuarter,
  quarterYears,
} from "@/lib/quarter";
import { loadQuarterInvoices } from "@/lib/quarter-load";
import {
  QUARTER_TOTALS_NOTE,
  summarizeInvoices,
  vatRateLabel,
} from "@/lib/quarter-summary";
import { QuarterPicker } from "./QuarterPicker";
import { QuarterZipButton } from "./QuarterZipButton";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string }>;
}) {
  const search = await searchParams;
  const now = new Date();
  const { year, q } =
    parseQuarter(search.year, search.q) ?? lastClosedQuarter(now);
  const supabase = await createClient();
  const result = await loadQuarterInvoices(supabase, year, q);
  const summary = result.ok ? summarizeInvoices(result.invoices) : null;
  const isEmpty = result.ok && result.invoices.length === 0;

  const counts = summary
    ? [
        {
          key: "simplified",
          label: "Simplificadas",
          value: summary.counts.simplified,
        },
        { key: "full", label: "Completas", value: summary.counts.full },
        {
          key: "rectifying",
          label: "Rectificativas",
          value: summary.counts.rectifying,
        },
        {
          key: "replaced",
          label: "Sustituidas",
          value: summary.counts.replaced,
        },
      ]
    : [];
  const totals = (summary?.vatRates ?? []).reduce(
    (sum, rate) => ({
      base_cents: sum.base_cents + rate.base_cents,
      vat_cents: sum.vat_cents + rate.vat_cents,
    }),
    { base_cents: 0, vat_cents: 0 },
  );

  return (
    <>
      <PageHeader
        title="Facturación"
        description="Totales de las facturas emitidas en un trimestre y el libro de facturas para la gestoría."
        actions={
          summary &&
          !isEmpty && (
            <div className="flex flex-wrap gap-2">
              <QuarterZipButton year={year} q={q} />
              <Button asChild data-testid="quarter-download-xlsx">
                <a href={`/facturacion/excel?year=${year}&q=${q}`} download>
                  Descargar Excel
                </a>
              </Button>
            </div>
          )
        }
      />
      <section className="flex flex-col gap-6 border-separator border-b pb-8 md:flex-row md:items-end md:justify-between">
        <QuarterPicker year={year} q={q} years={quarterYears(year, now)} />
        {summary && !isEmpty && (
          <div className="flex flex-col gap-1 md:items-end">
            <p className="text-[13px] text-text-tertiary">
              Total neto del T{q} de {year}
            </p>
            <p
              className="font-bold text-[2.5rem] text-ink-900 leading-none tracking-[-0.015em] tabular-nums"
              data-testid="quarter-net"
            >
              {formatCents(summary.net_cents)}
            </p>
          </div>
        )}
      </section>
      {isCurrentQuarter(year, q, now) && (
        <Alert tone="warning" data-testid="quarter-current">
          Trimestre en curso: los datos pueden cambiar.
        </Alert>
      )}
      {!result.ok && (
        <Alert data-testid="quarter-error">
          No se ha podido cargar el trimestre. Recarga la página.
        </Alert>
      )}
      {isEmpty && (
        <p data-testid="quarter-empty" className="text-[15px] text-ink-800">
          No hay facturas en el T{q} de {year}.
        </p>
      )}
      {summary && !isEmpty && (
        <>
          <p
            data-testid="quarter-counts"
            className="text-[13px] text-ink-800 leading-8"
          >
            {counts.map((count, index) => (
              <Fragment key={count.key}>
                {index > 0 && " "}
                <span className="whitespace-nowrap">
                  {index > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="mr-1.5 ml-0.5 text-text-tertiary"
                      >
                        ·
                      </span>{" "}
                    </>
                  )}
                  {count.label}{" "}
                  <span
                    className="mr-1.5 ml-1 font-bold text-ink-900 text-xl tabular-nums"
                    data-testid={`quarter-count-${count.key}`}
                  >
                    {count.value}
                  </span>
                </span>
              </Fragment>
            ))}
          </p>
          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-ink-900 text-xl">Importes por IVA</h2>
            <Table aria-label="Importes por IVA" data-testid="quarter-vat">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>IVA</TableHeaderCell>
                  <TableHeaderCell className="text-right">Base</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Cuota
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Total
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.vatRates.map((rate) => (
                  <TableRow
                    key={rate.vat_rate}
                    data-testid={`quarter-vat-${rate.vat_rate}`}
                  >
                    <TableCell className="font-medium max-md:text-[15px]">
                      {vatRateLabel(rate.vat_rate)}
                    </TableCell>
                    <TableCell label="Base" className="text-right tabular-nums">
                      {formatCents(rate.base_cents)}
                    </TableCell>
                    <TableCell
                      label="Cuota"
                      className="text-right tabular-nums"
                    >
                      {formatCents(rate.vat_cents)}
                    </TableCell>
                    <TableCell
                      label="Total"
                      className="text-right tabular-nums"
                    >
                      {formatCents(rate.total_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot className="max-md:mt-2 max-md:block">
                <TableRow
                  data-testid="quarter-vat-total"
                  className="border-separator border-double font-bold md:border-t-[3px]"
                >
                  <TableCell className="max-md:text-[15px]">Total</TableCell>
                  <TableCell label="Base" className="text-right tabular-nums">
                    {formatCents(totals.base_cents)}
                  </TableCell>
                  <TableCell label="Cuota" className="text-right tabular-nums">
                    {formatCents(totals.vat_cents)}
                  </TableCell>
                  <TableCell label="Total" className="text-right tabular-nums">
                    {formatCents(summary.net_cents)}
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
            <p className="text-[13px] text-ink-800">{QUARTER_TOTALS_NOTE}</p>
          </section>
        </>
      )}
    </>
  );
}
