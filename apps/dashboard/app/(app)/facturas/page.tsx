import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import Link from "next/link";
import {
  formatInvoiceDate,
  invoiceKindLabel,
  invoiceRecipientLabel,
  invoiceStatusLabel,
  invoicesListHref,
  invoicesListParams,
  invoicesPageCount,
  loadInvoices,
} from "@/lib/invoices-load";
import { formatEuros } from "@/lib/payments";
import { InvoicesFilters } from "./InvoicesFilters";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    tipo?: string;
    q?: string;
    profesional?: string;
    pagina?: string;
  }>;
}) {
  const search = await searchParams;
  const params = invoicesListParams(search, todayInMadrid());
  const supabase = await createClient();
  const result = await loadInvoices(supabase, params);

  const rows = result.ok ? result.data.rows : [];
  const staffOptions = result.ok ? result.data.staffOptions : [];
  const isOwner = result.ok ? result.data.isOwner : false;
  const totalCount = result.ok ? result.data.totalCount : null;
  const hasError = !result.ok;
  const pastEnd = result.ok && params.page > 1 && rows.length === 0;
  const isEmpty = rows.length === 0;
  const pageCount = totalCount !== null ? invoicesPageCount(totalCount) : null;

  return (
    <>
      <PageHeader title="Facturas" />
      <Card>
        <InvoicesFilters
          params={params}
          staffOptions={staffOptions}
          isOwner={isOwner}
        />
      </Card>
      {hasError && (
        <Card
          role="alert"
          className="text-center text-sm text-danger-600"
          data-testid="invoices-error"
        >
          No se ha podido cargar el listado. Recarga la página.
        </Card>
      )}
      {!hasError && isEmpty && !pastEnd && (
        <Card
          className="text-center text-sm text-ink-800"
          data-testid="invoices-empty"
        >
          No hay facturas con estos filtros.
        </Card>
      )}
      {!hasError && isEmpty && pastEnd && (
        <Card
          className="flex flex-col items-center gap-2 text-center text-sm text-ink-800"
          data-testid="invoices-empty-page"
        >
          No hay más facturas.
          <Link
            href={invoicesListHref({ ...params, page: 1 })}
            data-testid="invoices-back-to-first"
          >
            Volver a la primera página
          </Link>
        </Card>
      )}
      {!hasError && !isEmpty && (
        <>
          <Table aria-label="Facturas" data-testid="invoices-list">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Código</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Tipo</TableHeaderCell>
                <TableHeaderCell>Destinatario o paciente</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid="invoice-row">
                  <TableCell className="font-medium">
                    <Link
                      href={`/facturas/${row.id}`}
                      data-testid="invoice-open"
                    >
                      {row.code}
                    </Link>
                  </TableCell>
                  <TableCell>{formatInvoiceDate(row.issuedAt)}</TableCell>
                  <TableCell>{invoiceKindLabel(row.kind)}</TableCell>
                  <TableCell>{invoiceRecipientLabel(row)}</TableCell>
                  <TableCell>{formatEuros(row.totalCents)}</TableCell>
                  <TableCell data-testid="invoice-status">
                    {invoiceStatusLabel(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pageCount !== null && pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm text-ink-800">
              {params.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={invoicesListHref({
                      ...params,
                      page: params.page - 1,
                    })}
                    data-testid="invoices-prev"
                  >
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span>
                Página {params.page} de {pageCount}
              </span>
              {params.page < pageCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={invoicesListHref({
                      ...params,
                      page: params.page + 1,
                    })}
                    data-testid="invoices-next"
                  >
                    Siguiente
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
