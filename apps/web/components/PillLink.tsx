import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "sage" | "cream";

const toneStyles: Record<Tone, string> = {
  sage: "border-sage-500 text-sage-700 hover:bg-sage-500 hover:text-cream-50",
  cream: "border-cream-50/80 text-cream-50 hover:bg-cream-50/15",
};

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-7 py-3 text-action transition-colors";

export function pillClassName(tone: Tone = "sage", className = "") {
  return `${base} ${toneStyles[tone]} ${className}`;
}

type PillLinkProps = ComponentProps<typeof Link> & {
  tone?: Tone;
  children: ReactNode;
};

export function PillLink({
  tone = "sage",
  className = "",
  children,
  ...props
}: PillLinkProps) {
  return (
    <Link {...props} className={pillClassName(tone, className)}>
      {children}
    </Link>
  );
}
