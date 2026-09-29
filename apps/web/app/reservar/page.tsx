import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/PageHero";
import {
  ANY_PROFESSIONAL,
  type BookingState,
  bookingError,
  bookingState,
  formatWhen,
  groupSlotsByDay,
  NEW_PERSON,
  SLOT_TAKEN,
  type Slot,
} from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";
import { BirthDateForm } from "./BirthDateForm";
import { ConfirmForm } from "./ConfirmForm";
import {
  loadCatalog,
  loadHorizonDays,
  loadPeople,
  loadPrivacyAccepted,
  loadSlots,
} from "./load";
import { NewPersonForm } from "./NewPersonForm";
import { type PickerDay, SlotPicker } from "./SlotPicker";
import {
  type AccountPerson,
  type BookingStep,
  bookingStep,
  type CatalogService,
  type CatalogSpecialty,
} from "./step";
import { WhoStep } from "./WhoStep";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Reservar cita · Clínica LUMIA en Xàtiva",
    description:
      "Reserva tu cita en LUMIA: elige especialidad, servicio, profesional y el hueco que mejor te venga.",
    path: "/reservar",
  }),
};

const optionClass =
  "flex w-full flex-col gap-1 rounded-3xl border-2 border-sage-500 px-6 py-5 text-left text-ink-600 transition-colors hover:bg-sage-500/15";

function reservar(state: BookingState) {
  const query = bookingState.encode(state);
  return query ? `/reservar?${query}` : "/reservar";
}

function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function Step({
  number,
  title,
  back,
  children,
}: {
  number: number;
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {back && (
        <Link
          href={back}
          className="text-sage-600 text-sm underline-offset-2 hover:underline"
        >
          ← Volver
        </Link>
      )}
      <p className="mt-4 text-ink-500 text-sm">Paso {number} de 7</p>
      <h1 className="mt-1 font-bold text-ink-600 text-section">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function PhoneLink({ children }: { children: ReactNode }) {
  return (
    <a
      href={site.phone.href}
      className="font-medium text-sage-600 underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function SpecialtyStep({ catalog }: { catalog: CatalogSpecialty[] }) {
  return (
    <Step number={1} title="¿Qué especialidad necesitas?">
      <ul className="flex flex-col gap-3">
        {catalog.map((specialty) => (
          <li key={specialty.id}>
            <Link
              href={reservar({ especialidad: specialty.id })}
              data-testid="booking-specialty"
              className={optionClass}
            >
              <span className="font-bold text-lg">{specialty.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Step>
  );
}

function ServiceSummary({ service }: { service: CatalogService }) {
  return (
    <>
      <span className="font-bold text-lg">{service.name}</span>
      <span className="text-ink-500 text-sm">
        {service.durationMinutes} min · {formatPrice(service.priceCents)}
      </span>
    </>
  );
}

function ServiceStep({ specialty }: { specialty: CatalogSpecialty }) {
  return (
    <Step number={2} title={specialty.name} back={reservar({})}>
      <p className="-mt-4 mb-6 text-ink-500">Elige el servicio.</p>
      <ul className="flex flex-col gap-3">
        {specialty.services.map((service) => (
          <li key={service.id}>
            {service.phoneOnly ? (
              <div
                data-testid="booking-phone-only"
                className="flex flex-col gap-1 rounded-3xl border-2 border-sage-400/60 px-6 py-5 text-ink-600"
              >
                <ServiceSummary service={service} />
                <span className="mt-2 text-sm">
                  Reserva por teléfono:{" "}
                  <PhoneLink>{site.phone.display}</PhoneLink>
                </span>
              </div>
            ) : (
              <Link
                href={reservar({
                  especialidad: specialty.id,
                  servicio: service.id,
                })}
                data-testid="booking-service"
                className={optionClass}
              >
                <ServiceSummary service={service} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Step>
  );
}

function PhoneOnlyStep({
  specialty,
  service,
}: {
  specialty: CatalogSpecialty;
  service: CatalogService;
}) {
  return (
    <Step
      number={2}
      title={service.name}
      back={reservar({ especialidad: specialty.id })}
    >
      <p data-testid="booking-phone-only" className="text-ink-500">
        Reserva por teléfono: <PhoneLink>{site.phone.display}</PhoneLink>
      </p>
    </Step>
  );
}

function ProfessionalStep({
  specialty,
  service,
}: {
  specialty: CatalogSpecialty;
  service: CatalogService;
}) {
  const base = { especialidad: specialty.id, servicio: service.id };
  const options = [
    { id: ANY_PROFESSIONAL, label: "El primer hueco libre" },
    ...specialty.professionals.map((professional) => ({
      id: professional.id,
      label: professional.full_name,
    })),
  ];
  return (
    <Step
      number={3}
      title="¿Con quién?"
      back={reservar({ especialidad: specialty.id })}
    >
      <ul className="flex flex-col gap-3">
        {options.map((option) => (
          <li key={option.id}>
            <Link
              href={reservar({ ...base, profesional: option.id })}
              data-testid="booking-professional"
              className={optionClass}
            >
              <span className="font-bold text-lg">{option.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Step>
  );
}

async function SlotStep({
  specialty,
  service,
  professional,
  from,
  nextFrom,
  today,
  signedIn,
  slotTaken,
}: {
  specialty: CatalogSpecialty;
  service: CatalogService;
  professional: string;
  from: string;
  nextFrom: string | null;
  today: string;
  signedIn: boolean;
  slotTaken: boolean;
}) {
  const base = {
    especialidad: specialty.id,
    servicio: service.id,
    profesional: professional,
  };
  const slots = await loadSlots(service.id, professional, from);
  const hrefFor = (slot: Slot) => {
    const chosen = reservar({ ...base, fecha: from, inicio: slot.starts_at });
    return signedIn ? chosen : `/acceder?next=${encodeURIComponent(chosen)}`;
  };
  const toPicker = (slot: Slot) => ({
    startsAt: slot.starts_at,
    time: madridDateTime(slot.starts_at).time,
    href: hrefFor(slot),
  });
  const days: PickerDay[] = groupSlotsByDay(slots, today).map((day) => ({
    date: day.date,
    label: day.label,
    morning: day.morning.map(toPicker),
    afternoon: day.afternoon.map(toPicker),
  }));
  return (
    <Step
      number={4}
      title="Elige día y hora"
      back={reservar({ especialidad: specialty.id, servicio: service.id })}
    >
      <p className="-mt-4 mb-6 text-ink-500">
        {service.name} · {service.durationMinutes} min
      </p>
      {slotTaken && (
        <p
          role="alert"
          data-testid="booking-error"
          className="mb-6 rounded-2xl bg-cream-100 px-4 py-3 text-ink-600 text-sm"
        >
          {bookingError({ message: "slot_not_available" })}
        </p>
      )}
      {days.length > 0 ? (
        <SlotPicker key={from} days={days} />
      ) : (
        <p
          data-testid="booking-no-slots"
          className="rounded-2xl bg-cream-50 px-5 py-4 text-ink-600"
        >
          No hay huecos estos días. Llámanos al{" "}
          <PhoneLink>{site.phone.display}</PhoneLink> y te buscamos uno.
        </p>
      )}
      {nextFrom && (
        <Link
          href={reservar({ ...base, fecha: nextFrom })}
          data-testid="booking-next-days"
          className="mt-8 inline-flex h-11 items-center rounded-full border-2 border-sage-500 px-6 text-sage-600 transition-colors hover:bg-sage-500 hover:text-cream-50"
        >
          Siguientes días
        </Link>
      )}
    </Step>
  );
}

type ChosenProps = {
  specialty: CatalogSpecialty;
  service: CatalogService;
  professional: string;
  from: string;
  startsAt: string;
};

function chosenBase({ specialty, service, professional, from }: ChosenProps) {
  return {
    especialidad: specialty.id,
    servicio: service.id,
    profesional: professional,
    fecha: from,
  };
}

function AppointmentSummary({
  testId,
  specialty,
  service,
  professional,
  startsAt,
  person,
}: ChosenProps & { testId: string; person?: AccountPerson }) {
  const professionalName =
    specialty.professionals.find((candidate) => candidate.id === professional)
      ?.full_name ?? "El primer hueco libre";
  return (
    <dl
      data-testid={testId}
      className="flex flex-col gap-3 rounded-3xl bg-cream-50 px-6 py-5 text-ink-600"
    >
      <div>
        <dt className="text-ink-500 text-sm">Cuándo</dt>
        <dd className="font-bold">{formatWhen(startsAt)}</dd>
      </div>
      <div>
        <dt className="text-ink-500 text-sm">Servicio</dt>
        <dd>
          {service.name} · {service.durationMinutes} min ·{" "}
          {formatPrice(service.priceCents)}
        </dd>
      </div>
      <div>
        <dt className="text-ink-500 text-sm">Profesional</dt>
        <dd>{professionalName}</dd>
      </div>
      {person && (
        <div>
          <dt className="text-ink-500 text-sm">Para</dt>
          <dd>
            {person.first_name} {person.last_name}
          </dd>
        </div>
      )}
    </dl>
  );
}

function ChosenStep(props: ChosenProps) {
  const base = chosenBase(props);
  const next = reservar({ ...base, inicio: props.startsAt });

  return (
    <div>
      <Link
        href={reservar(base)}
        className="text-sage-600 text-sm underline-offset-2 hover:underline"
      >
        ← Cambiar la hora
      </Link>
      <h1 className="mt-4 mb-8 font-bold text-ink-600 text-section">Tu cita</h1>
      <AppointmentSummary testId="booking-chosen" {...props} />
      <Link
        href={`/acceder?next=${encodeURIComponent(next)}`}
        className="mt-8 inline-flex h-11 items-center rounded-full bg-sage-600 px-8 text-cream-50 transition-colors hover:bg-sage-700"
      >
        Continuar
      </Link>
    </div>
  );
}

function WhoView(props: ChosenProps & { people: AccountPerson[] }) {
  const chosen = { ...chosenBase(props), inicio: props.startsAt };
  return (
    <Step
      number={6}
      title="¿Para quién es la cita?"
      back={reservar(chosenBase(props))}
    >
      <WhoStep
        people={props.people}
        personHref={(personId) => reservar({ ...chosen, persona: personId })}
        otherHref={reservar({ ...chosen, persona: NEW_PERSON })}
      />
    </Step>
  );
}

function DetailsView(
  props: ChosenProps & {
    firstTime: boolean;
    needsPrivacy: boolean;
    guardians: AccountPerson[];
    today: string;
  },
) {
  const chosen = { ...chosenBase(props), inicio: props.startsAt };
  return (
    <Step
      number={6}
      title={props.firstTime ? "Tus datos" : "Otra persona"}
      back={props.firstTime ? reservar(chosenBase(props)) : reservar(chosen)}
    >
      <NewPersonForm
        estado={bookingState.encode(chosen)}
        needsPrivacy={props.needsPrivacy}
        guardians={props.guardians.map((guardian) => ({
          id: guardian.id,
          name: `${guardian.first_name} ${guardian.last_name}`,
        }))}
        today={props.today}
      />
    </Step>
  );
}

function BirthDateView(
  props: ChosenProps & { person: AccountPerson; today: string },
) {
  const chosen = { ...chosenBase(props), inicio: props.startsAt };
  return (
    <Step
      number={6}
      title={`${props.person.first_name} ${props.person.last_name}`}
      back={reservar(chosen)}
    >
      <p className="-mt-4 mb-6 text-ink-500">
        Para reservar necesitamos su fecha de nacimiento.
      </p>
      <BirthDateForm
        estado={bookingState.encode({ ...chosen, persona: props.person.id })}
        today={props.today}
      />
    </Step>
  );
}

function SummaryView(props: ChosenProps & { person: AccountPerson }) {
  const chosen = { ...chosenBase(props), inicio: props.startsAt };
  return (
    <Step number={7} title="Revisa tu cita" back={reservar(chosen)}>
      <AppointmentSummary testId="booking-summary" {...props} />
      <ConfirmForm
        estado={bookingState.encode({ ...chosen, persona: props.person.id })}
      />
    </Step>
  );
}

function EmptyStep() {
  return (
    <div>
      <h1 className="font-bold text-ink-600 text-section">Reservar cita</h1>
      <p data-testid="booking-empty" className="mt-6 text-ink-500">
        Ahora mismo no hay citas para reservar online. Llámanos al{" "}
        <PhoneLink>{site.phone.display}</PhoneLink> y te buscamos una.
      </p>
    </div>
  );
}

function StepView({
  step,
  today,
  signedIn,
  slotTaken,
}: {
  step: BookingStep;
  today: string;
  signedIn: boolean;
  slotTaken: boolean;
}) {
  switch (step.kind) {
    case "empty":
      return <EmptyStep />;
    case "specialty":
      return <SpecialtyStep catalog={step.catalog} />;
    case "service":
      return <ServiceStep specialty={step.specialty} />;
    case "phoneOnly":
      return (
        <PhoneOnlyStep specialty={step.specialty} service={step.service} />
      );
    case "professional":
      return (
        <ProfessionalStep specialty={step.specialty} service={step.service} />
      );
    case "slots":
      return (
        <SlotStep
          specialty={step.specialty}
          service={step.service}
          professional={step.professional}
          from={step.from}
          nextFrom={step.nextFrom}
          today={today}
          signedIn={signedIn}
          slotTaken={slotTaken}
        />
      );
    case "chosen":
      return <ChosenStep {...step} />;
    case "who":
      return <WhoView {...step} />;
    case "details":
      return <DetailsView {...step} today={today} />;
    case "birthDate":
      return <BirthDateView {...step} today={today} />;
    case "summary":
      return <SummaryView {...step} />;
  }
}

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = bookingState.decode(await searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);
  const today = todayInMadrid();
  const choosingPerson = Boolean(user && state.inicio);
  const [catalog, horizonDays, people, privacyAccepted] = await Promise.all([
    loadCatalog(),
    loadHorizonDays(),
    choosingPerson ? loadPeople() : null,
    choosingPerson ? loadPrivacyAccepted() : false,
  ]);
  const step = bookingStep({
    catalog,
    state,
    today,
    horizonDays,
    now: new Date(),
    people,
    privacyAccepted,
  });

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          {user?.email && (
            <p className="mb-8 text-ink-500 text-sm">
              Has entrado como{" "}
              <span data-testid="reservar-email">{user.email}</span>
            </p>
          )}
          <StepView
            step={step}
            today={today}
            signedIn={signedIn}
            slotTaken={state.aviso === SLOT_TAKEN}
          />
        </div>
      </section>
    </>
  );
}
