import type { Faq } from "@/lib/faqs";
import { ArrowDownCircle } from "./icons";

export function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div data-testid="faq-accordion" className="flex flex-col">
      {items.map((item) => (
        <details
          key={item.question}
          className="group border-cream-50/40 border-b py-5"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 text-cream-50">
            <ArrowDownCircle className="size-6 shrink-0 transition-transform group-open:rotate-180" />
            <span className="font-medium text-lg md:text-xl">
              {item.question}
            </span>
          </summary>
          <p className="mt-4 max-w-4xl pr-4 pl-9 text-cream-50/90 leading-relaxed">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
