import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { Pagination } from "@clinicalumia/ui/pagination";
import {
  rowLinkClass,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  formatInvoiceDate,
  invoiceKindLabel,
  invoiceRecipientLabel,
  invoiceStatusBadge,
  invoiceStatusLabel,
  invoicesListHref,
  invoicesListParams,
  invoicesPageCount,
  loadInvoices,
} from "@/lib/invoices-load";
import { formatEuros } from "@/lib/payments";
import { InvoicesFilters } from "./InvoicesFilters";

export const metadata: Metadata = { title: "Facturas" };

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
      <PageHeader
        title="Facturas"
        description="Facturas emitidas a partir de los cobros."
      />
      <InvoicesFilters
        params={params}
        staffOptions={staffOptions}
        isOwner={isOwner}
      />
      {hasError && (
        <Alert data-testid="invoices-error">
          No se ha podido cargar el listado. Recarga la página.
        </Alert>
      )}
      {!hasError && isEmpty && !pastEnd && (
        <EmptyState
          data-testid="invoices-empty"
          icon={<ReceiptText />}
          title="No hay facturas con estos filtros."
        />
      )}
      {!hasError && isEmpty && pastEnd && (
        <EmptyState
          data-testid="invoices-empty-page"
          title="No hay más facturas."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link
                href={invoicesListHref({ ...params, page: 1 })}
                data-testid="invoices-back-to-first"
              >
                Volver a la primera página
              </Link>
            </Button>
          }
        />
      )}
      {!hasError && !isEmpty && (
        <>
          <Table
            aria-label="Facturas"
            variant="list"
            data-testid="invoices-list"
          >
            <TableHead>
              <TableRow>
                <TableHeaderCell>Código</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Tipo</TableHeaderCell>
                <TableHeaderCell>Destinatario o paciente</TableHeaderCell>
                <TableHeaderCell numeric>Total</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} linked data-testid="invoice-row">
                  <TableCell
                    className="font-semibold text-[15px] tabular-nums"
                    mobile="primary"
                  >
                    <Link
                      href={`/facturas/${row.id}`}
                      data-testid="invoice-open"
                      className={rowLinkClass}
                    >
                      {row.code}
                    </Link>
                  </TableCell>
                  <TableCell label="Fecha" mobile="secondary">
                    {formatInvoiceDate(row.issuedAt)}
                  </TableCell>
                  <TableCell label="Tipo" mobile="secondary">
                    {invoiceKindLabel(row.kind)}
                  </TableCell>
                  <TableCell label="Destinatario o paciente" mobile="secondary">
                    {invoiceRecipientLabel(row)}
                  </TableCell>
                  <TableCell label="Total" numeric mobile="trailing">
                    {formatEuros(row.totalCents)}
                  </TableCell>
                  <TableCell
                    label="Estado"
                    mobile="secondary"
                    data-testid="invoice-status"
                  >
                    <Badge
                      tone={invoiceStatusBadge(row).tone}
                      className={
                        invoiceStatusBadge(row).struck
                          ? "line-through"
                          : undefined
                      }
                    >
                      {invoiceStatusLabel(row)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pageCount !== null && (
            <Pagination
              page={params.page}
              pageCount={pageCount}
              hrefFor={(page) => invoicesListHref({ ...params, page })}
              testIdPrefix="invoices"
            />
          )}
        </>
      )}
    </>
  );
}
