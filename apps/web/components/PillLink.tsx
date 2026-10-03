import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "sage" | "cream" | "solid" | "light";

const toneStyles: Record<Tone, string> = {
  sage: "border-sage-500 text-sage-500 hover:bg-sage-500 hover:text-cream-50",
  cream: "border-cream-50 text-cream-50 hover:bg-cream-50/15",
  solid:
    "border-sage-800 bg-sage-800 text-cream-50 hover:border-sage-900 hover:bg-sage-900",
  light: "border-cream-50 bg-cream-50 text-ink-900 hover:bg-white",
};

const base =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-6 font-medium text-base transition-colors";

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
