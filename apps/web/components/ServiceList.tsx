import Link from "next/link";
import type { Service } from "@/lib/services";
import { ArrowRightIcon } from "./icons";

export function ServiceList({ items }: { items: Service[] }) {
  return (
    <ul data-testid="service-list" className="border-sage-300 border-b">
      {items.map((service) => (
        <li key={service.number} className="border-sage-300 border-t">
          <Link
            href={`/${service.slug}`}
            className="group grid grid-cols-[2.5rem_1fr_3rem] items-center gap-4 py-6 transition-colors hover:bg-sage-500/10 md:grid-cols-[4rem_1.2fr_1fr_3rem] md:gap-8 md:py-8"
          >
            <span className="font-medium text-sage-800 text-sm">
              {service.number}
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="font-bold text-ink-900 text-xl tracking-tight md:text-[1.75rem] md:leading-tight">
                {service.title}
              </span>
              <span className="text-base text-ink-800 leading-relaxed md:text-lg">
                {service.summary}
              </span>
            </span>
            <span className="hidden flex-wrap gap-1.5 md:flex">
              {service.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-cream-200 px-3 py-1 text-ink-900 text-sm"
                >
                  {tag}
                </span>
              ))}
            </span>
            <span className="flex size-12 items-center justify-center rounded-full border-2 border-sage-800 text-sage-800 transition-colors group-hover:bg-sage-800 group-hover:text-cream-50">
              <ArrowRightIcon className="size-5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
