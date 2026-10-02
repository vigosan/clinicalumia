import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { ageOn, isMinor } from "@clinicalumia/api/person";
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
import { Archive, Plus, SearchX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  listPatients,
  patientsListHref,
  patientsListParams,
  patientsPageCount,
} from "@/lib/patients-list";
import { patientsListState } from "@/lib/patients-list-state";
import { SearchBox } from "./SearchBox";

export const metadata: Metadata = { title: "Pacientes" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; pagina?: string }>;
}) {
  const params = patientsListParams(await searchParams);
  const { q, archived: showArchived } = params;
  const supabase = await createClient();

  const { data: people, error, count } = await listPatients(supabase, params);
  const patients = people ?? [];
  const today = todayInMadrid();
  const failed = Boolean(error) && error?.code !== "PGRST103";
  const state = patientsListState(failed, patients.length);
  const pageCount = patientsPageCount(count ?? 0);

  return (
    <>
      <PageHeader
        title="Pacientes"
        actions={
          <Button asChild size="sm" data-testid="patient-new">
            <Link href="/patients/new">
              <Plus aria-hidden="true" />
              Nuevo paciente
            </Link>
          </Button>
        }
      />
      <SearchBox defaultQuery={q} defaultArchived={showArchived} />
      {state === "error" && (
        <Alert data-testid="patients-error">
          No se ha podido cargar el listado. Recarga la página.
        </Alert>
      )}
      {state === "empty" && params.page > 1 && (
        <EmptyState
          data-testid="patients-empty"
          title="No hay más fichas."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href={patientsListHref({ ...params, page: 1 })}>
                Volver a la primera página
              </Link>
            </Button>
          }
        />
      )}
      {state === "empty" && params.page === 1 && (
        <EmptyState
          data-testid="patients-empty"
          icon={q ? <SearchX /> : showArchived ? <Archive /> : <Users />}
          title={
            q
              ? "No hay pacientes ni tutores con esos datos."
              : showArchived
                ? "No hay fichas archivadas."
                : "Todavía no hay pacientes."
          }
          description={
            q
              ? "Prueba con el DNI/NIE, el teléfono o el email."
              : showArchived
                ? "Las fichas que archives aparecerán aquí."
                : "Crea la primera ficha con «Nuevo paciente»."
          }
        />
      )}
      {state === "list" && (
        <>
          <Table aria-label="Pacientes">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Edad</TableHeaderCell>
                <TableHeaderCell>Teléfono</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((person) => {
                const minor = person.birth_date
                  ? isMinor(person.birth_date, today)
                  : false;
                return (
                  <TableRow key={person.id} linked data-testid="patient-row">
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/patients/${person.id}`}
                          data-testid="patient-link"
                          className={rowLinkClass}
                        >
                          {person.first_name} {person.last_name}
                        </Link>
                        {minor && (
                          <Badge tone="warning" data-testid="patient-minor">
                            Menor
                          </Badge>
                        )}
                        {!person.is_patient && (
                          <Badge tone="outline">Tutor/a</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell label="Edad" data-testid="patient-age">
                      {person.birth_date
                        ? `${ageOn(person.birth_date, today)} años`
                        : "—"}
                    </TableCell>
                    <TableCell label="Teléfono">
                      {person.phone ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            page={params.page}
            pageCount={pageCount}
            hrefFor={(page) => patientsListHref({ ...params, page })}
            testIdPrefix="patients"
          />
        </>
      )}
    </>
  );
}
