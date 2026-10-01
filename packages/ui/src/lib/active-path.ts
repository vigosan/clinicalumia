export function isActivePath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isActiveNavItem(
  item: { href: string; match?: string[] },
  pathname: string,
): boolean {
  return [item.href, ...(item.match ?? [])].some((href) =>
    isActivePath(href, pathname),
  );
}
