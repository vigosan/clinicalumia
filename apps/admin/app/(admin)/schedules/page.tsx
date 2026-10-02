import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { splitClosures } from "@/lib/closures";
import { AddClosure } from "./AddClosure";
import { AddTimeOff } from "./AddTimeOff";
import { ClosureRow } from "./ClosureRow";
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

  const { data: closures } = await supabase
    .from("clinic_closures")
    .select("id, starts_on, ends_on, reason");
  const today = todayInMadrid();
  const { upcoming, past } = splitClosures(closures ?? [], today);

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
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink-900">Días de cierre</h2>
          <AddClosure today={today} />
        </div>
        <p className="text-[15px] text-ink-800">
          Días en que la clínica no abre. La web no ofrece huecos esos días y
          las citas que ya hay no se cancelan.
        </p>
        {upcoming.length > 0 ? (
          <Card className="p-2">
            <ul>
              {upcoming.map((closure) => (
                <ClosureRow key={closure.id} closure={closure} />
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState title="No hay cierres previstos." />
        )}
        {past.length > 0 && (
          <details data-testid="closures-past">
            <summary className="cursor-pointer text-[15px] font-medium text-ink-900">
              Cierres anteriores
            </summary>
            <Card className="mt-3 p-2">
              <ul>
                {past.map((closure) => (
                  <ClosureRow key={closure.id} closure={closure} />
                ))}
              </ul>
            </Card>
          </details>
        )}
      </section>
    </>
  );
}
