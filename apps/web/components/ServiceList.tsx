import { PillLink } from "@/components/PillLink";
import type { Service } from "@/lib/services";

export function ServiceList({ items }: { items: Service[] }) {
  return (
    <ul data-testid="service-list" className="flex flex-col">
      {items.map((service) => (
        <li
          key={service.number}
          className="grid gap-6 border-sage-500 border-b-2 py-8 md:grid-cols-[48fr_52fr] md:grid-rows-[auto_1fr] md:gap-0 md:pt-[2.604vw] md:pb-[2.19vw]"
        >
          <span className="font-black text-section text-ink-600 leading-none md:ml-[0.573vw]">
            {service.number}
          </span>

          <div className="flex flex-col md:row-span-2 md:mt-1">
            <h3 className="font-bold text-section text-ink-600 leading-none">
              {service.title}
            </h3>
            <p className="mt-2 text-body text-ink-500 md:mt-[0.365vw]">
              {service.summary}
            </p>
            <p className="mt-3 font-medium text-body text-ink-600 md:mt-[0.781vw]">
              {service.tags.join(" · ")}
            </p>
          </div>

          <PillLink
            href={`/${service.slug}`}
            className="justify-self-start self-start md:mt-[4.505vw] md:ml-[0.573vw]"
          >
            Saber más
          </PillLink>
        </li>
      ))}
    </ul>
  );
}
