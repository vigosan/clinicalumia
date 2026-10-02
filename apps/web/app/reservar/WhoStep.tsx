import Link from "next/link";
import type { AccountPerson } from "./step";

const optionClass =
  "flex w-full flex-col gap-1 rounded-3xl border-2 border-sage-500 px-6 py-5 text-left text-ink-800 transition-colors hover:bg-sage-500/15";

export function WhoStep({
  people,
  personHref,
  otherHref,
}: {
  people: AccountPerson[];
  personHref: (personId: string) => string;
  otherHref: string;
}) {
  return (
    <ul data-testid="booking-who" className="flex flex-col gap-3">
      {people.map((person) => (
        <li key={person.id}>
          <Link
            href={personHref(person.id)}
            data-testid="booking-person"
            className={optionClass}
          >
            <span className="font-bold text-lg">
              {person.first_name} {person.last_name}
            </span>
            {person.is_minor && (
              <span className="text-ink-800 text-sm">Menor a tu cargo</span>
            )}
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={otherHref}
          data-testid="booking-other-person"
          className={optionClass}
        >
          <span className="font-bold text-lg">Otra persona</span>
          <span className="text-ink-800 text-sm">
            Alguien que aún no está en tu cuenta
          </span>
        </Link>
      </li>
    </ul>
  );
}
