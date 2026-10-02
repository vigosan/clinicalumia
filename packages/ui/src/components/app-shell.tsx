"use client";

import { ChevronsUpDown, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { closeButtonClass, overlayClass } from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { NavLink } from "./nav-link";

export type NavItem = {
  href: string;
  label: string;
  match?: string[];
  icon?: ReactNode;
  count?: number;
};

export type UserMenuItem = {
  href: string;
  label: string;
  icon: ReactNode;
  testId?: string;
};

type User = { name: string; detail: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function Sections({
  nav,
  className,
  onNavigate,
}: {
  nav: NavItem[];
  className: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Secciones" className={className}>
      {nav.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          match={item.match}
          icon={item.icon}
          count={item.count}
          onClick={onNavigate}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({
  user,
  menu,
  logout,
}: {
  user: User;
  menu: UserMenuItem[];
  logout: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="user-menu"
        aria-label={`Cuenta de ${user.name}, ${user.detail}`}
        className="flex cursor-pointer items-center gap-3 rounded-full p-1 text-left transition-colors hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-sage-800 data-[state=open]:bg-sage-100 lg:w-full lg:rounded-xl lg:px-2 lg:py-2"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-800 font-medium text-[13px] text-cream-50"
        >
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 flex-1 flex-col lg:flex">
          <span className="truncate text-sm font-medium text-ink-900">
            {user.name}
          </span>
          <span className="truncate text-[13px] text-ink-800">
            {user.detail}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className="hidden size-4 shrink-0 text-text-tertiary lg:block"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="lg:w-(--radix-dropdown-menu-trigger-width) lg:min-w-0"
      >
        <DropdownMenuLabel>
          <span className="text-sm font-medium text-ink-900">{user.name}</span>
          <span className="text-[13px] text-ink-800">{user.detail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menu.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} data-testid={item.testId}>
              {item.icon}
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {menu.length > 0 && <DropdownMenuSeparator />}
        <form action={logout}>
          <DropdownMenuItem
            asChild
            onSelect={(event) => event.preventDefault()}
          >
            <button type="submit" data-testid="logout">
              <LogOut aria-hidden="true" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({
  logo,
  section,
  nav,
}: {
  logo: ReactNode;
  section: string;
  nav: NavItem[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const close = (event: { matches: boolean }) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-testid="nav-toggle"
        aria-label="Abrir menú"
        className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-sage-800 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col gap-8 border-line border-r bg-cream-50 px-5 py-6 shadow-[8px_0_32px_-16px_rgb(58_58_58/0.3)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out motion-safe:data-[state=open]:animate-slide-in-left motion-safe:data-[state=closed]:animate-slide-out-left"
        >
          <Dialog.Title className="sr-only">Menú</Dialog.Title>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5 px-3">
              {logo}
              <span className="text-xs font-medium tracking-[0.12em] text-sage-800 uppercase">
                {section}
              </span>
            </div>
            <Dialog.Close aria-label="Cerrar menú" className={closeButtonClass}>
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Sections
            nav={nav}
            className="flex flex-col gap-0.5"
            onNavigate={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({
  logo,
  section,
  nav,
  user,
  menu = [],
  logout,
  children,
}: {
  logo: ReactNode;
  section: string;
  nav: NavItem[];
  user: User;
  menu?: UserMenuItem[];
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50 lg:flex-row">
      <aside className="sticky top-0 z-40 flex items-center gap-2 border-line border-b bg-cream-50 px-4 py-3 lg:h-screen lg:w-62 lg:overflow-y-auto lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-10 lg:border-r lg:border-b-0 lg:px-5 lg:pt-9 lg:pb-5">
        <MobileMenu logo={logo} section={section} nav={nav} />
        <div className="flex min-w-0 flex-col gap-1.5 lg:px-3 [&_img]:h-auto [&_img]:max-w-30 lg:[&_img]:max-w-none">
          {logo}
          <span className="hidden text-xs font-medium tracking-[0.12em] text-sage-800 uppercase lg:block">
            {section}
          </span>
        </div>
        <Sections
          nav={nav}
          className="hidden flex-1 flex-col gap-0.5 lg:flex"
        />
        <div className="ml-auto lg:ml-0 lg:border-separator lg:border-t lg:pt-4">
          <UserMenu user={user} menu={menu} logout={logout} />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        {children}
      </main>
    </div>
  );
}
