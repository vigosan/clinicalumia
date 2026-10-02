"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

export function showUrl(href: string) {
  window.history.pushState(null, "", href);
}

export function useUrlDrawer(param: string, value = "1") {
  const searchParams = useSearchParams();
  return searchParams.get(param) === value;
}

export function DrawerLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    showUrl(href);
  }

  return <Link href={href} prefetch={false} onClick={handleClick} {...props} />;
}
