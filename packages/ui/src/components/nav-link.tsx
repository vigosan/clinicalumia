"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActiveNavItem } from "../lib/active-path";
import { cn } from "../lib/cn";

export function NavLink({
  href,
  match,
  onClick,
  children,
}: {
  href: string;
  match?: string[];
  onClick?: () => void;
  children: ReactNode;
}) {
  const active = isActiveNavItem({ href, match }, usePathname());
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] transition-colors",
        active
          ? "bg-sage-800 font-medium text-cream-50"
          : "text-ink-800 hover:bg-sage-100",
      )}
    >
      {children}
    </Link>
  );
}
