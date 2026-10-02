import {
  isValidDate,
  madridDateTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import type { Metadata } from "next";
import {
  adjacentAppointments,
  canMarkNoShow,
  canMove,
  isUuid,
  professionalOptions,
} from "@/lib/agenda";
import {
  type AppointmentEventRow,
  appointmentHistory,
} from "@/lib/appointment-history";
import {
  currentInvoice,
  proposedInvoiceEmail,
  recipientDraft,
} from "@/lib/invoices";
import { loadLastFullRecipient } from "@/lib/invoices-load";
import { canVoidPayment, paymentStatus } from "@/lib/payments";
import { AgendaHeader } from "./agenda/AgendaHeader";
import {
  type AppointmentDetail,
  AppointmentPanel,
} from "./agenda/AppointmentPanel";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { NewAppointmentDrawer } from "./agenda/NewAppointmentDrawer";
import { SeeAlso } from "./agenda/SeeAlso";
import { WeekView } from "./agenda/WeekView";
import { loadAppointmentForm } from "./appointments/load-form";

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

function neighbourHrefs(
  { previousId, nextId }: { previousId: string | null; nextId: string | null },
  hrefFor: (id: string) => string,
) {
  return {
    previousHref: previousId ? hrefFor(previousId) : null,
    nextHref: nextId ? hrefFor(nextId) : null,
  };
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
      "id, professional_id, starts_at, ends_at, status, notes, price_cents, cancelled_by, cancel_reason, origin, patient:people(id, first_name, last_name, email, tax_id, address, birth_date), service:services(id, name, duration_minutes, specialty_id)",
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
    { data: noticeRecipients },
    lastRecipient,
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("appointment_events")
      .select(
        "id, kind, previous_starts_at, previous_ends_at, previous_professional_id, actor_id, actor_kind, created_at",
      )
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: true }),
    supabase.rpc("staff_directory"),
    supabase
      .from("payments")
      .select(
        "id, amount_cents, method, note, collected_at, collected_by, voided_at, voided_by, void_reason, invoices(id, code, kind, status, issued_at, rectifies_invoice_id)",
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
    supabase.rpc("appointment_notice_recipients", {
      p_appointment_id: appointmentId,
    }),
    loadLastFullRecipient(supabase, appt.patient.id),
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
  const isOwner =
    (directory ?? []).find((profile) => profile.id === user.id)?.role ===
    "owner";
  const formerIds = [
    appt.professional_id,
    ...(events ?? []).map((event) => event.previous_professional_id),
  ].filter((id): id is string => id !== null && !nameById.has(id));
  if (isOwner && formerIds.length > 0) {
    const { data: former } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", formerIds);
    for (const profile of former ?? [])
      nameById.set(profile.id, profile.full_name);
  }
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
  const initial = madridDateTime(appt.starts_at);
  const invoice = activePayment ? currentInvoice(activePayment.invoices) : null;
  const guardian = guardianRows?.[0]?.guardian ?? null;
  const minor = appt.patient.birth_date
    ? isMinor(appt.patient.birth_date, todayInMadrid(now))
    : false;
  const invoiceEmail = proposedInvoiceEmail({
    patient: appt.patient,
    guardian,
  });

  return {
    status: "ok",
    detail: {
      id: appt.id,
      patientId: appt.patient.id,
      patientName: `${appt.patient.first_name} ${appt.patient.last_name}`,
      professionalId: appt.professional_id,
      professionalName,
      professionalOptions: isOwner
        ? professionalOptions({
            directory: directory ?? [],
            specialtyId: appt.service.specialty_id,
            current: { id: appt.professional_id, name: professionalName },
          })
        : null,
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
        email: invoiceEmail,
        saveEmail: invoiceEmail === "" && !minor,
      },
      recipient: recipientDraft({
        patient: appt.patient,
        guardian,
        minor,
        lastRecipient,
      }),
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
      canNotify: (noticeRecipients ?? []).length > 0,
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
    new?: string;
    time?: string;
    professional?: string;
    patient?: string;
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

  const [result, appointment, newAppointment] = await Promise.all([
    loadAgenda({ date, view, withIds, personId }),
    loadAppointmentDetail(appointmentId),
    params.new === "1"
      ? loadAppointmentForm({
          date,
          time: params.time,
          professional: params.professional,
          patient: params.patient,
        })
      : null,
  ]);

  if (!result.ok) {
    return (
      <Alert data-testid="agenda-error">
        No se ha podido cargar la agenda.
      </Alert>
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
        {newAppointment?.ok === false && (
          <Alert data-testid="appointment-form-error">
            No se han podido cargar los datos del formulario.
          </Alert>
        )}
        {newAppointment?.ok && (
          <NewAppointmentDrawer
            closeHref={buildHref("/", {
              date: data.date,
              view,
              person: personParam,
            })}
            form={newAppointment.form}
          />
        )}
        {appointment.status === "error" && (
          <Alert data-testid="appointment-panel-error">
            No se ha podido cargar la cita.
          </Alert>
        )}
        {appointment.status === "ok" && (
          <AppointmentPanel
            key={appointment.detail.id}
            appointment={appointment.detail}
            closeHref={buildHref("/", {
              date: data.date,
              view,
              person: personParam,
            })}
            {...neighbourHrefs(
              adjacentAppointments(
                data.days.flatMap((day) => day.appointments),
                appointment.detail.id,
                [],
              ),
              (id) =>
                buildHref("/", {
                  date: data.date,
                  view: "week",
                  person: data.personId,
                  appointment: id,
                }),
            )}
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
        closure={data.closure}
        firstHour={data.firstHour}
        lastHour={data.lastHour}
      />
      {newAppointment?.ok === false && (
        <Alert data-testid="appointment-form-error">
          No se han podido cargar los datos del formulario.
        </Alert>
      )}
      {newAppointment?.ok && (
        <NewAppointmentDrawer
          closeHref={buildHref("/", { date: data.date, with: withParam })}
          form={newAppointment.form}
        />
      )}
      {appointment.status === "error" && (
        <Alert data-testid="appointment-panel-error">
          No se ha podido cargar la cita.
        </Alert>
      )}
      {appointment.status === "ok" && (
        <AppointmentPanel
          key={appointment.detail.id}
          appointment={appointment.detail}
          closeHref={buildHref("/", { date: data.date, view, with: withParam })}
          {...neighbourHrefs(
            adjacentAppointments(
              data.appointments,
              appointment.detail.id,
              data.columns.map((column) => column.id),
            ),
            (id) =>
              buildHref("/", {
                date: data.date,
                view,
                with: withParam,
                appointment: id,
              }),
          )}
        />
      )}
    </div>
  );
}
