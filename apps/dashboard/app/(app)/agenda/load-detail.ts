import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { canMarkNoShow, canMove, professionalOptions } from "@/lib/agenda";
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
import type { AppointmentDetail } from "./AppointmentPanel";

export type AppointmentDetailResult =
  | { status: "none" }
  | { status: "error" }
  | { status: "ok"; detail: AppointmentDetail };

export async function loadAppointmentDetail(
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

  let pendingIds: string[] = [];
  if (isOwner) {
    const { data: pending, error: pendingError } = await supabase.rpc(
      "pending_invitations",
    );
    if (pendingError || !pending) return { status: "error" };
    pendingIds = pending.map((row) => row.profile_id);
  }

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
            pendingIds,
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
