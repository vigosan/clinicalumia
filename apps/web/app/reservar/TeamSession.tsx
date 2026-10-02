import { PageHero } from "@/components/PageHero";
import { STAFF_EMAIL } from "@/lib/booking";

export function TeamSession() {
  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <p
            data-testid="booking-team-session"
            className="rounded-2xl bg-cream-50 px-5 py-4 text-ink-600"
          >
            {STAFF_EMAIL}
          </p>
        </div>
      </section>
    </>
  );
}
