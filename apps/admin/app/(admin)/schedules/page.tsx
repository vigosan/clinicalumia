import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { scheduleSources } from "@/lib/schedule";
import { AddTimeOff } from "./AddTimeOff";
import { EmployeePicker } from "./EmployeePicker";
import { ScheduleEditor } from "./ScheduleEditor";
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

  const [{ data: schedules }, { data: timeOff }] = selected
    ? await Promise.all([
        supabase
          .from("employee_schedules")
          .select("profile_id, weekday, starts_at, ends_at")
          .in(
            "profile_id",
            employees.map((person) => person.id),
          ),
        supabase.rpc("time_off_between", {
          p_profile_ids: [selected.id],
          p_from: new Date().toISOString(),
        }),
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
              blocks={(schedules ?? []).filter(
                (block) => block.profile_id === selected.id,
              )}
              sources={scheduleSources(employees, schedules ?? [], selected.id)}
            />
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ink-900">Ausencias</h2>
                <AddTimeOff
                  profileId={selected.id}
                  employeeName={selected.full_name}
                />
              </div>
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
