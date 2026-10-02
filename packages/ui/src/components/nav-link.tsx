"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActiveNavItem } from "../lib/active-path";
import { cn } from "../lib/cn";

export function NavLink({
  href,
  match,
  icon,
  count,
  onClick,
  children,
}: {
  href: string;
  match?: string[];
  icon?: ReactNode;
  count?: number;
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
        "relative flex h-10 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[15px] transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
        active
          ? "bg-sage-100 font-medium text-sage-900 before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sage-800"
          : "text-ink-800 hover:bg-cream-200 [&_svg]:text-text-tertiary",
      )}
    >
      {icon && (
        <span aria-hidden="true" className="flex">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {count ? (
        <>
          <span
            aria-hidden="true"
            data-testid="nav-count"
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-medium text-[12px] text-sage-900 tabular-nums",
              active ? "bg-surface" : "bg-sage-100",
            )}
          >
            {count}
          </span>
          <span className="sr-only">, {count} pendientes</span>
        </>
      ) : null}
    </Link>
  );
}
