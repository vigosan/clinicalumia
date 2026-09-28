import { isValidDate, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Card } from "@clinicalumia/ui/card";
import { AgendaHeader } from "./agenda/AgendaHeader";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { SeeAlso } from "./agenda/SeeAlso";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; with?: string }>;
}) {
  const params = await searchParams;
  const date =
    params.date && isValidDate(params.date) ? params.date : todayInMadrid();
  const view = params.view === "week" ? "week" : "day";
  const withIds = (params.with ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id));

  const result = await loadAgenda({ date, view, withIds });

  if (!result.ok) {
    return (
      <Card
        role="alert"
        className="text-center text-danger-600 text-sm"
        data-testid="agenda-error"
      >
        No se ha podido cargar la agenda.
      </Card>
    );
  }

  const { data } = result;
  const withParam = data.selectedColleagueIds.join(",");

  return (
    <div className="flex flex-col gap-6">
      <AgendaHeader
        date={data.date}
        view={view}
        withParam={withParam}
        isOwner={data.isOwner}
        selfId={data.selfId}
      />
      {!data.isOwner && (
        <SeeAlso
          date={data.date}
          view={view}
          candidates={data.candidates}
          selectedIds={data.selectedColleagueIds}
        />
      )}
      <DayView
        date={data.date}
        view={view}
        withParam={withParam}
        selfId={data.selfId}
        columns={data.columns}
        appointments={data.appointments}
        busy={data.busy}
        timeOff={data.timeOff}
        schedulesByColumn={data.schedulesByColumn}
        firstHour={data.firstHour}
        lastHour={data.lastHour}
      />
    </div>
  );
}
