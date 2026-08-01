import { PillLink } from "@/components/PillLink";
import type { Service } from "@/lib/services";

export function ServiceList({ items }: { items: Service[] }) {
  return (
    <ul data-testid="service-list" className="flex flex-col">
      {items.map((service) => (
        <li
          key={service.number}
          className="grid gap-6 border-sage-400/50 border-t py-10 md:grid-cols-[1fr_2fr] md:gap-12 md:py-14"
        >
          <div className="flex flex-col items-start gap-6">
            <span className="font-bold text-4xl text-ink-600 md:text-5xl">
              {service.number}
            </span>
            <PillLink href={`/${service.slug}`}>Saber más</PillLink>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-card text-ink-600 md:text-section">
              {service.title}
            </h3>
            <p className="max-w-2xl text-ink-500 text-lg leading-relaxed">
              {service.summary}
            </p>
            <p className="font-medium text-ink-600">
              {service.tags.join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
