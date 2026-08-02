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
          <summary className="flex cursor-pointer list-none items-center gap-4 text-cream-50">
            <ArrowDownCircle className="size-7 shrink-0 transition-transform group-open:rotate-180" />
            <span className="font-bold text-question">{item.question}</span>
          </summary>
          <p className="mt-5 pr-4 pl-11 text-body text-cream-50/90">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
