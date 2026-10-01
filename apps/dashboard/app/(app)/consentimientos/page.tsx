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
      <Card>
        <ConsentsSearch
          defaultQuery={params.q}
          defaultPendingOnly={params.pendingOnly}
        />
      </Card>
      {state === "error" && (
        <Card
          role="alert"
          className="text-center text-sm text-danger-600"
          data-testid="consents-error"
        >
          No se ha podido cargar el listado. Recarga la página.
        </Card>
      )}
      {state === "empty" && (
        <Card
          className="text-center text-sm text-ink-800"
          data-testid="consents-empty"
        >
          No hay consentimientos con esos datos.
        </Card>
      )}
      {state === "list" && (
        <>
          <Table aria-label="Consentimientos" data-testid="consents-list">
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
                <TableRow key={consent.id} data-testid="consent-row">
                  <TableCell>{formatSignedAt(consent.signed_at)}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/consentimientos/${consent.id}`}
                      data-testid="consent-open"
                    >
                      {consent.first_name} {consent.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>{consent.tax_id}</TableCell>
                  <TableCell data-testid="consent-status">
                    {consent.person ? (
                      <>
                        Asociado a la ficha de{" "}
                        <Link href={`/patients/${consent.person.id}`}>
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
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm text-ink-800">
              {params.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={consentsListHref({
                      ...params,
                      page: params.page - 1,
                    })}
                    data-testid="consents-prev"
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
                    href={consentsListHref({
                      ...params,
                      page: params.page + 1,
                    })}
                    data-testid="consents-next"
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
