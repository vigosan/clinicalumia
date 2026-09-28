import { createClient } from "@clinicalumia/api/server";
import { Badge } from "@clinicalumia/ui/badge";
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
import { patientsListState } from "@/lib/patients-list-state";
import {
  ageOn,
  isMinor,
  normalizeSearch,
  todayInMadrid,
  toIlikePattern,
} from "@/lib/person";
import { SearchBox } from "./SearchBox";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const showArchived = archived === "1";
  const supabase = await createClient();

  let query = supabase
    .from("people")
    .select("id, first_name, last_name, birth_date, phone, is_patient")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(50);

  query = showArchived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  if (q) {
    query = query.ilike("search_text", toIlikePattern(normalizeSearch(q)));
  }

  const { data: people, error } = await query;
  const patients = people ?? [];
  const today = todayInMadrid();
  const state = patientsListState(Boolean(error), patients.length);

  return (
    <>
      <PageHeader
        title="Pacientes"
        actions={
          <Button asChild data-testid="patient-new">
            <Link href="/patients/new">Nueva persona</Link>
          </Button>
        }
      />
      <Card>
        <SearchBox defaultQuery={q ?? ""} defaultArchived={showArchived} />
      </Card>
      {state === "error" && (
        <Card
          role="alert"
          className="text-center text-sm text-danger-600"
          data-testid="patients-error"
        >
          No se ha podido cargar el listado. Recarga la página.
        </Card>
      )}
      {state === "empty" && (
        <Card
          className="text-center text-sm text-ink-800"
          data-testid="patients-empty"
        >
          No se ha encontrado a nadie con esos datos.
        </Card>
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
                  <TableRow key={person.id} data-testid="patient-row">
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {person.first_name} {person.last_name}
                        </span>
                        {minor && (
                          <Badge tone="warning" data-testid="patient-minor">
                            Menor
                          </Badge>
                        )}
                        {!person.is_patient && (
                          <Badge tone="outline">Tutora/Tutor</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {person.birth_date
                        ? `${ageOn(person.birth_date, today)} años`
                        : "—"}
                    </TableCell>
                    <TableCell>{person.phone ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {patients.length === 50 && (
            <p
              className="text-sm text-ink-800"
              data-testid="patients-truncated"
            >
              Se muestran los 50 primeros. Afina la búsqueda para ver más.
            </p>
          )}
        </>
      )}
    </>
  );
}
