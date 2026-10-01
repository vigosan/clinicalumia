import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import { formatCents } from "@/lib/money";
import {
  isCurrentQuarter,
  lastClosedQuarter,
  parseQuarter,
  quarterYears,
} from "@/lib/quarter";
import { loadQuarterInvoices } from "@/lib/quarter-load";
import { summarizeInvoices, vatRateLabel } from "@/lib/quarter-summary";
import { QuarterPicker } from "./QuarterPicker";

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

  return (
    <>
      <PageHeader
        title="Facturación"
        description="Totales de las facturas emitidas en un trimestre y el libro de facturas para la gestoría."
        actions={
          summary &&
          !isEmpty && (
            <Button asChild data-testid="quarter-download-xlsx">
              <a href={`/facturacion/excel?year=${year}&q=${q}`} download>
                Descargar Excel
              </a>
            </Button>
          )
        }
      />
      <Card>
        <QuarterPicker year={year} q={q} years={quarterYears(year, now)} />
      </Card>
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
        <EmptyState
          data-testid="quarter-empty"
          title={`No hay facturas en el T${q} de ${year}.`}
        />
      )}
      {summary && !isEmpty && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink-900">Facturas</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {counts.map((count) => (
                <Card key={count.key} className="flex flex-col gap-1">
                  <p className="text-[13px] text-ink-800">{count.label}</p>
                  <p
                    className="text-2xl font-bold text-ink-900"
                    data-testid={`quarter-count-${count.key}`}
                  >
                    {count.value}
                  </p>
                </Card>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink-900">Importes por IVA</h2>
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
            </Table>
            <Card className="flex items-baseline justify-between gap-4">
              <p className="font-medium text-ink-900">
                Total neto del trimestre
              </p>
              <p
                className="text-2xl font-bold tabular-nums text-ink-900"
                data-testid="quarter-net"
              >
                {formatCents(summary.net_cents)}
              </p>
            </Card>
            <p className="text-[13px] text-ink-800">
              Las rectificativas restan. Una completa que sustituye a una
              simplificada aparece en el libro pero no suma: ya cuenta la
              simplificada original.
            </p>
          </section>
        </>
      )}
    </>
  );
}
