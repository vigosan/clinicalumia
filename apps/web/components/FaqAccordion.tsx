import type { Faq } from "@/lib/faqs";
import { ArrowDownCircle } from "./icons";

export function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div
      data-testid="faq-accordion"
      className="flex flex-col gap-8 md:gap-[2.46vw]"
    >
      {items.map((item) => (
        <details key={item.question} open>
          <summary className="flex cursor-pointer list-none items-center gap-3 border-cream-50 border-b pb-3 text-cream-50 md:pb-[1.198vw]">
            <ArrowDownCircle className="size-7 shrink-0 md:size-[1.563vw]" />
            <span className="font-bold text-question">{item.question}</span>
          </summary>
          <p className="mt-4 text-body text-cream-50 md:mt-[1.23vw]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
