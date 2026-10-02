import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/PageHero";
import {
  type AppointmentRow,
  accountNotice,
  changeWindowText,
  splitAppointments,
  statusLabel,
} from "@/lib/account";
import { formatWhen, isTeamSession } from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { TeamSession } from "../reservar/TeamSession";
import { signOutOfAccount } from "./actions";
import { loadAccount } from "./load";
import { requirePatientPage } from "./session";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Mi cuenta · Clínica LUMIA en Xàtiva",
    description: "Tus citas, las personas de tu cuenta y tus datos en LUMIA.",
    path: "/mi-cuenta",
  }),
  robots: { index: false },
};

const cardClass = "rounded-3xl bg-cream-50 px-6 py-5 text-ink-600";
const pillClass =
  "inline-flex h-10 items-center rounded-full border-2 border-sage-500 px-5 text-sage-600 text-sm transition-colors hover:bg-sage-500 hover:text-cream-50";

function Section({
  testId,
  title,
  children,
}: {
  testId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="mt-12">
      <h2 className="font-bold text-ink-600 text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Upcoming({ appointment }: { appointment: AppointmentRow }) {
  const when = formatWhen(appointment.starts_at).toLowerCase();
  return (
    <li
      data-testid="account-appointment"
      data-appointment-id={appointment.id}
      className={cardClass}
    >
      <p className="font-bold">{formatWhen(appointment.starts_at)}</p>
      <p className="mt-1">
        {appointment.service_name} · {appointment.professional_name}
      </p>
      <p className="mt-1 text-ink-500">Para {appointment.person_name}</p>
      <p className="mt-3 text-ink-500 text-sm">
        {changeWindowText(appointment)}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`/mi-cuenta/citas/${appointment.id}/cita.ics`}
          data-testid="account-add-to-calendar"
          aria-label={`Añadir a mi calendario la cita del ${when}`}
          className={pillClass}
        >
          Añadir a mi calendario
        </a>
        {appointment.can_change && appointment.can_reschedule && (
          <Link
            href={`/mi-cuenta/citas/${appointment.id}/cambiar`}
            data-testid="account-reschedule"
            aria-label={`Cambiar la cita del ${when}`}
            className={pillClass}
          >
            Cambiar
          </Link>
        )}
        {appointment.can_change && (
          <Link
            href={`/mi-cuenta/citas/${appointment.id}/cancelar`}
            data-testid="account-cancel"
            aria-label={`Cancelar la cita del ${when}`}
            className={pillClass}
          >
            Cancelar
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function MiCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const { aviso } = await searchParams;
  const user = await requirePatientPage("/mi-cuenta");

  const account = await loadAccount().catch((error) => {
    if (isTeamSession(error)) return null;
    throw error;
  });
  if (!account) return <TeamSession />;

  const now = new Date();
  const { upcoming, history } = splitAppointments(account.appointments, now);
  const notice = accountNotice(typeof aviso === "string" ? aviso : undefined);

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-bold text-ink-600 text-section">Mi cuenta</h1>
          <p className="mt-3 break-words text-ink-500 text-sm">
            Has entrado como {user.email}
          </p>

          {notice && (
            <p
              role="status"
              data-testid="account-notice"
              className="mt-8 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-ink-600"
            >
              {notice}
            </p>
          )}

          <Section testId="account-upcoming" title="Próximas citas">
            {upcoming.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {upcoming.map((appointment) => (
                  <Upcoming key={appointment.id} appointment={appointment} />
                ))}
              </ul>
            ) : (
              <div className={cardClass}>
                <p>Todavía no tienes citas.</p>
                <Link href="/reservar" className={`mt-4 ${pillClass}`}>
                  Reservar una cita
                </Link>
              </div>
            )}
          </Section>

          <Section testId="account-history" title="Historial">
            {history.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {history.map((appointment) => (
                  <li key={appointment.id} className={cardClass}>
                    <p className="font-bold">
                      {formatWhen(appointment.starts_at)}
                    </p>
                    <p className="mt-1">
                      {appointment.service_name} ·{" "}
                      {appointment.professional_name}
                    </p>
                    <p className="mt-1 text-ink-500">
                      Para {appointment.person_name}
                    </p>
                    <p className="mt-3 text-ink-500 text-sm">
                      {statusLabel(appointment, now)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500">Aún no hay citas pasadas.</p>
            )}
          </Section>

          <Section testId="account-people" title="Personas">
            {account.people.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {account.people.map((person) => (
                  <li key={person.id} className={cardClass}>
                    <p className="font-bold">
                      {person.first_name} {person.last_name}
                    </p>
                    {person.is_minor && (
                      <p className="mt-1 text-ink-500 text-sm">Menor</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/mi-cuenta/menores/nuevo"
              data-testid="account-add-minor"
              className={pillClass}
            >
              Añadir un menor
            </Link>
          </Section>

          {account.contacts.length > 0 && (
            <Section testId="account-contact" title="Datos de contacto">
              <ul className="flex flex-col gap-3">
                {account.contacts.map((contact) => (
                  <li key={contact.personId} className={cardClass}>
                    <p className="font-bold">{contact.name}</p>
                    <dl className="mt-2 flex flex-col gap-2">
                      <div>
                        <dt className="text-ink-500 text-sm">Teléfono</dt>
                        <dd>{contact.phone || "Sin teléfono"}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-500 text-sm">Dirección</dt>
                        <dd className="break-words">
                          {contact.address || "Sin dirección"}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/mi-cuenta/contacto/${contact.personId}`}
                      data-testid="account-edit-contact"
                      aria-label={`Cambiar los datos de ${contact.name}`}
                      className={`mt-4 ${pillClass}`}
                    >
                      Cambiar
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <form action={signOutOfAccount} className="mt-12">
            <button
              type="submit"
              data-testid="account-logout"
              className="cursor-pointer rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700"
            >
              Salir
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
