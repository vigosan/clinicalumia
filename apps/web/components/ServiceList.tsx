import { PillLink } from "@/components/PillLink";
import type { Service } from "@/lib/services";

export function ServiceList({ items }: { items: Service[] }) {
  return (
    <ul data-testid="service-list" className="flex flex-col">
      {items.map((service) => (
        <li
          key={service.number}
          className="grid gap-6 border-sage-400/50 border-t py-8 md:grid-cols-[48fr_52fr] md:gap-0 md:py-[2.3vw]"
        >
          <div className="flex flex-col items-start gap-[4.7vw]">
            <span className="font-bold text-section text-ink-600 leading-none">
              {service.number}
            </span>
            <PillLink href={`/${service.slug}`}>Saber más</PillLink>
          </div>

          <div className="flex flex-col">
            <h3 className="font-bold text-section text-ink-600 leading-none">
              {service.title}
            </h3>
            <p className="mt-[1.6vw] text-body text-ink-500">
              {service.summary}
            </p>
            <p className="mt-[1.3vw] font-medium text-body text-ink-600 md:text-[1.25vw]">
              {service.tags.join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
