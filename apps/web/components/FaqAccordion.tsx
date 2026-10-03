import type { Faq } from "@/lib/faqs";
import { PlusIcon } from "./icons";

export function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div data-testid="faq-accordion" className="border-sage-300 border-b">
      {items.map((item) => (
        <details key={item.question} className="group border-sage-300 border-t">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-bold text-ink-900 text-lg md:py-6 md:text-xl [&::-webkit-details-marker]:hidden">
            {item.question}
            <PlusIcon className="size-6 shrink-0 text-sage-800 transition-transform group-open:rotate-45" />
          </summary>
          <p className="max-w-3xl pb-6 text-base text-ink-800 leading-relaxed md:text-lg">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
