import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
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
import { FileSignature } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  consentsListHref,
  consentsListParams,
  consentsListResult,
  consentsPageCount,
  formatSignedAt,
  hasPendingConsents,
  linkedPersonLabel,
  listConsents,
} from "@/lib/consents";
import { patientsListState } from "@/lib/patients-list-state";
import { ConsentsSearch } from "./ConsentsSearch";

export const metadata: Metadata = { title: "Consentimientos" };

export default async function ConsentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pendientes?: string; pagina?: string }>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const hasPending =
    search.pendientes === undefined
      ? await hasPendingConsents(supabase)
      : false;
  const params = consentsListParams(search, hasPending);

  const { consents, failed, total } = consentsListResult(
    await listConsents(supabase, params),
  );
  const state = patientsListState(failed, consents.length);
  const pageCount = consentsPageCount(total);

  return (
    <>
      <PageHeader
        title="Consentimientos"
        description="Formularios firmados en la web. Asócialos a la ficha del paciente."
      />
      <ConsentsSearch
        defaultQuery={params.q}
        defaultPendingOnly={params.pendingOnly}
      />
      {state === "error" && (
        <Alert data-testid="consents-error">
          No se ha podido cargar el listado. Recarga la página.
        </Alert>
      )}
      {state === "empty" && (
        <EmptyState
          data-testid="consents-empty"
          icon={<FileSignature />}
          title="No hay consentimientos con esos datos."
        />
      )}
      {state === "list" && (
        <>
          <Table
            aria-label="Consentimientos"
            variant="list"
            data-testid="consents-list"
          >
            <TableHead>
              <TableRow>
                <TableHeaderCell>Firmado</TableHeaderCell>
                <TableHeaderCell>Paciente</TableHeaderCell>
                <TableHeaderCell>DNI/NIE</TableHeaderCell>
                <TableHeaderCell>Ficha</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consents.map((consent) => (
                <TableRow key={consent.id} linked data-testid="consent-row">
                  <TableCell label="Firmado" mobile="secondary">
                    {formatSignedAt(consent.signed_at)}
                  </TableCell>
                  <TableCell className="font-medium" mobile="primary">
                    <Link
                      href={`/consentimientos/${consent.id}`}
                      data-testid="consent-open"
                      className={rowLinkClass}
                    >
                      {consent.first_name} {consent.last_name}
                    </Link>
                  </TableCell>
                  <TableCell
                    label="DNI/NIE"
                    mobile={consent.tax_id ? "secondary" : "hidden"}
                  >
                    {consent.tax_id ?? "—"}
                  </TableCell>
                  <TableCell mobile="secondary" data-testid="consent-status">
                    {consent.person ? (
                      <>
                        Asociado a la ficha de{" "}
                        <Link
                          href={`/patients/${consent.person.id}`}
                          className="relative z-10"
                        >
                          {linkedPersonLabel(consent.person)}
                        </Link>
                      </>
                    ) : (
                      "Pendiente de asociar"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={params.page}
            pageCount={pageCount}
            hrefFor={(page) => consentsListHref({ ...params, page })}
            testIdPrefix="consents"
          />
        </>
      )}
    </>
  );
}
