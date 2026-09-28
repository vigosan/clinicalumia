import { isValidDate, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Card } from "@clinicalumia/ui/card";
import { isUuid } from "@/lib/agenda";
import { AgendaHeader } from "./agenda/AgendaHeader";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { SeeAlso } from "./agenda/SeeAlso";
import { WeekView } from "./agenda/WeekView";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    with?: string;
    person?: string;
  }>;
}) {
  const params = await searchParams;
  const date =
    params.date && isValidDate(params.date) ? params.date : todayInMadrid();
  const view = params.view === "week" ? "week" : "day";
  const withIds = (params.with ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => isUuid(id));
  const personId =
    params.person && isUuid(params.person) ? params.person : null;

  const result = await loadAgenda({ date, view, withIds, personId });

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

  if (data.kind === "week") {
    const personParam = data.personId !== data.selfId ? data.personId : "";
    return (
      <div className="flex flex-col gap-6">
        <AgendaHeader
          date={data.date}
          view={view}
          withParam=""
          personParam={personParam}
          isOwner={data.isOwner}
          selfId={data.selfId}
        />
        <WeekView
          date={data.date}
          isOwner={data.isOwner}
          personId={data.personId}
          personName={data.personName}
          personSpecialtySlug={data.personSpecialtySlug}
          candidates={data.candidates}
          days={data.days}
          firstHour={data.firstHour}
          lastHour={data.lastHour}
        />
      </div>
    );
  }

  const withParam = data.selectedColleagueIds.join(",");

  return (
    <div className="flex flex-col gap-6">
      <AgendaHeader
        date={data.date}
        view={view}
        withParam={withParam}
        personParam=""
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
