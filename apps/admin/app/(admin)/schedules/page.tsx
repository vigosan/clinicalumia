import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { EmployeePicker } from "./EmployeePicker";
import { ScheduleEditor } from "./ScheduleEditor";
import { TimeOffForm } from "./TimeOffForm";
import { TimeOffRow } from "./TimeOffRow";

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const { employee } = await searchParams;
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const employees = profiles ?? [];
  const selected = employees.find((p) => p.id === employee) ?? employees[0];

  const [{ data: blocks }, { data: timeOff }] = selected
    ? await Promise.all([
        supabase
          .from("employee_schedules")
          .select("weekday, starts_at, ends_at")
          .eq("profile_id", selected.id),
        supabase
          .from("employee_time_off")
          .select("id, starts_at, ends_at, reason")
          .eq("profile_id", selected.id)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];

  return (
    <>
      <PageHeader
        title="Horarios"
        description="Horario semanal de cada persona del equipo y sus ausencias. La agenda solo ofrecerá huecos dentro de estos tramos."
      />
      {employees.length === 0 ? (
        <Card className="text-sm text-ink-800">
          Todavía no hay nadie en el equipo.
        </Card>
      ) : (
        selected && (
          <>
            <EmployeePicker employees={employees} selectedId={selected.id} />
            <ScheduleEditor
              key={selected.id}
              profileId={selected.id}
              blocks={blocks ?? []}
            />
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-ink-900">Ausencias</h2>
              <Card>
                <TimeOffForm profileId={selected.id} />
              </Card>
              {timeOff && timeOff.length > 0 ? (
                <Card className="p-2">
                  <ul>
                    {timeOff.map((item) => (
                      <TimeOffRow key={item.id} timeOff={item} />
                    ))}
                  </ul>
                </Card>
              ) : (
                <Card className="text-sm text-ink-800">
                  No hay ausencias previstas.
                </Card>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
