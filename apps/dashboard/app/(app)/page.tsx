import {
  isValidDate,
  madridDateTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import type { Metadata } from "next";
import { canMarkNoShow, canMove, isUuid } from "@/lib/agenda";
import {
  type AppointmentEventRow,
  appointmentHistory,
} from "@/lib/appointment-history";
import {
  currentInvoice,
  proposedInvoiceEmail,
  recipientDraft,
} from "@/lib/invoices";
import { canVoidPayment, paymentStatus } from "@/lib/payments";
import { AgendaHeader } from "./agenda/AgendaHeader";
import {
  type AppointmentDetail,
  AppointmentPanel,
} from "./agenda/AppointmentPanel";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { SeeAlso } from "./agenda/SeeAlso";
import { WeekView } from "./agenda/WeekView";

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

type AppointmentDetailResult =
  | { status: "none" }
  | { status: "error" }
  | { status: "ok"; detail: AppointmentDetail };

async function loadAppointmentDetail(
  appointmentId: string | null,
): Promise<AppointmentDetailResult> {
  if (!appointmentId) return { status: "none" };
  const supabase = await createClient();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      "id, professional_id, starts_at, ends_at, status, notes, price_cents, cancelled_by, cancel_reason, origin, patient:people(id, first_name, last_name, email, tax_id, address, birth_date), service:services(id, name, duration_minutes)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!appt?.patient || !appt.service) return { status: "none" };

  const durationMinutes = Math.round(
    (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) /
      60_000,
  );

  const [
    { data: events, error: eventsError },
    { data: directory, error: directoryError },
    { data: payments, error: paymentsError },
    { data: suggestedCents, error: suggestedError },
    { data: guardianRows, error: guardiansError },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("appointment_events")
      .select(
        "id, kind, previous_starts_at, previous_ends_at, actor_id, actor_kind, created_at",
      )
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: true }),
    supabase.rpc("staff_directory"),
    supabase
      .from("payments")
      .select(
        "id, amount_cents, method, note, collected_at, collected_by, voided_at, voided_by, void_reason, invoices(id, code, kind, status)",
      )
      .eq("appointment_id", appointmentId)
      .order("collected_at", { ascending: true }),
    supabase.rpc("suggested_amount", { p_appointment_id: appointmentId }),
    supabase
      .from("guardianships")
      .select(
        "is_primary, guardian:people!guardianships_guardian_id_fkey(first_name, last_name, email, tax_id, address)",
      )
      .eq("minor_id", appt.patient.id)
      .order("is_primary", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  if (
    eventsError ||
    directoryError ||
    paymentsError ||
    suggestedError ||
    guardiansError ||
    suggestedCents === null ||
    !user
  )
    return { status: "error" };

  const nameById = new Map(
    (directory ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const professionalName = nameById.get(appt.professional_id) ?? "Profesional";

  const paymentRows = payments ?? [];
  const history = appointmentHistory({
    events: (events ?? []) as AppointmentEventRow[],
    appointment: appt,
    payments: paymentRows,
    nameById,
  });

  const now = new Date();
  const activePayment =
    paymentRows.find((payment) => payment.voided_at === null) ?? null;
  const isOwner =
    (directory ?? []).find((profile) => profile.id === user.id)?.role ===
    "owner";
  const initial = madridDateTime(appt.starts_at);
  const invoice = activePayment ? currentInvoice(activePayment.invoices) : null;
  const guardian = guardianRows?.[0]?.guardian ?? null;

  return {
    status: "ok",
    detail: {
      id: appt.id,
      patientId: appt.patient.id,
      patientName: `${appt.patient.first_name} ${appt.patient.last_name}`,
      professionalId: appt.professional_id,
      professionalName,
      serviceId: appt.service.id,
      serviceName: appt.service.name,
      durationMinutes,
      startsAt: appt.starts_at,
      endsAt: appt.ends_at,
      status: appt.status,
      origin: appt.origin,
      notes: appt.notes,
      priceCents: appt.price_cents,
      paymentStatus: paymentStatus({
        appointment: appt,
        payment: activePayment,
        now,
      }).label,
      suggestedAmountCents: suggestedCents,
      canCollect: !activePayment,
      activePaymentId: activePayment?.id ?? null,
      invoice: invoice && {
        ...invoice,
        email: proposedInvoiceEmail({ patient: appt.patient, guardian }),
        recipient: recipientDraft({
          patient: appt.patient,
          guardian,
          minor: appt.patient.birth_date
            ? isMinor(appt.patient.birth_date, todayInMadrid(now))
            : false,
        }),
      },
      canVoid:
        activePayment !== null &&
        canVoidPayment({
          payment: activePayment,
          userId: user.id,
          isOwner,
          now,
        }),
      canMove: canMove({ status: appt.status, starts_at: appt.starts_at }, now),
      canMarkNoShow: canMarkNoShow(
        { status: appt.status, starts_at: appt.starts_at },
        now,
      ),
      canCancel: appt.status === "scheduled",
      canRestore: appt.status === "no_show",
      initialDate: initial.date,
      initialTime: initial.time.slice(0, 5),
      history,
    },
  };
}

export const metadata: Metadata = { title: "Agenda" };

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    with?: string;
    person?: string;
    appointment?: string;
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
  const appointmentId =
    params.appointment && isUuid(params.appointment)
      ? params.appointment
      : null;

  const [result, appointment] = await Promise.all([
    loadAgenda({ date, view, withIds, personId }),
    loadAppointmentDetail(appointmentId),
  ]);

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
          dayToWeekPerson=""
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
        {appointment.status === "error" && (
          <Card
            role="alert"
            className="text-center text-danger-600 text-sm"
            data-testid="appointment-panel-error"
          >
            No se ha podido cargar la cita.
          </Card>
        )}
        {appointment.status === "ok" && (
          <AppointmentPanel
            appointment={appointment.detail}
            closeHref={buildHref("/", {
              date: data.date,
              view,
              person: personParam,
            })}
          />
        )}
      </div>
    );
  }

  const withParam = data.selectedColleagueIds.join(",");
  const ownerSelectedIds = withIds.filter((id) =>
    data.candidates.some((candidate) => candidate.id === id),
  );
  const dayToWeekPerson =
    data.isOwner && ownerSelectedIds.length === 1
      ? (ownerSelectedIds[0] ?? "")
      : "";

  return (
    <div className="flex flex-col gap-6">
      <AgendaHeader
        date={data.date}
        view={view}
        withParam={withParam}
        personParam=""
        dayToWeekPerson={dayToWeekPerson}
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
      {appointment.status === "error" && (
        <Card
          role="alert"
          className="text-center text-danger-600 text-sm"
          data-testid="appointment-panel-error"
        >
          No se ha podido cargar la cita.
        </Card>
      )}
      {appointment.status === "ok" && (
        <AppointmentPanel
          appointment={appointment.detail}
          closeHref={buildHref("/", { date: data.date, view, with: withParam })}
        />
      )}
    </div>
  );
}
