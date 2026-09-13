import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="px-3 pt-3 md:px-4 md:pt-4">
      <div className="rounded-panel bg-sage-500 px-6 pt-36 pb-16 md:px-14 md:pt-44 md:pb-20">
        <div className="mx-auto max-w-4xl">
          {eyebrow && <div className="mb-6">{eyebrow}</div>}
          <h1 className="font-bold text-3xl text-cream-50 leading-tight tracking-tight md:text-hero">
            {title}
          </h1>
          {intro && (
            <p className="mt-6 max-w-3xl text-cream-50/90 text-lg leading-relaxed">
              {intro}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}
