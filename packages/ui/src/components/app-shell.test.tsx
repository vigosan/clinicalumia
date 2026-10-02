import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarDays, FileSignature, Users } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectExitThatOnlyFadesWithReducedMotion } from "../test/motion";
import { AppShell, type NavItem } from "./app-shell";

const pathname = vi.hoisted(() => ({ current: "/specialties" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const nav: NavItem[] = [
  { href: "/", label: "Inicio", match: ["/appointments"] },
  { href: "/specialties", label: "Especialidades" },
];

function renderShell(logout = vi.fn(async () => {}), items: NavItem[] = nav) {
  render(
    <AppShell
      logo={<span>LUMIA</span>}
      section="Administración"
      nav={items}
      user={{ name: "Patricia Hernán", detail: "Propietaria" }}
      menu={[
        {
          href: "/mi-calendario",
          label: "Ver citas en mi móvil",
          icon: <CalendarDays aria-hidden="true" />,
          testId: "user-menu-calendar",
        },
      ]}
      logout={logout}
    >
      <h1>Especialidades</h1>
    </AppShell>,
  );
  return logout;
}

describe("AppShell", () => {
  beforeEach(() => {
    pathname.current = "/specialties";
  });

  it("shows the sections, marks where you are, and keeps the page content in the main landmark", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(
      within(nav).getByRole("link", { name: "Especialidades" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Inicio" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(screen.getByRole("main")).getByRole("heading", {
        name: "Especialidades",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the parent section marked on pages that belong to it under another path", () => {
    pathname.current = "/appointments/new";
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(nav).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("groups the account options in a user menu so they do not compete with the sections", async () => {
    renderShell();
    expect(
      screen.queryByRole("menuitem", { name: "Ver citas en mi móvil" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("user-menu"));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Patricia Hernán")).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Ver citas en mi móvil" }),
    ).toHaveAttribute("href", "/mi-calendario");
    expect(
      within(menu).getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("signs out from the user menu", async () => {
    const logout = renderShell();
    await userEvent.click(screen.getByTestId("user-menu"));
    await userEvent.click(screen.getByTestId("logout"));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it("opens the sections in a side menu on narrow screens and closes it after choosing one", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId("nav-toggle"));
    const dialog = screen.getByRole("dialog", { name: "Menú" });
    await userEvent.click(within(dialog).getByRole("link", { name: "Inicio" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the side menu with Escape and gives focus back to the button that opened it", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId("nav-toggle"));
    expect(screen.getByRole("dialog", { name: "Menú" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-toggle")).toHaveFocus();
  });

  it("lets keyboard users open the user menu and sign out without a mouse", async () => {
    const logout = renderShell();
    screen.getByTestId("user-menu").focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByTestId("logout")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it("names the account button with everything it shows, so voice control users can say what they see", () => {
    renderShell();
    expect(screen.getByTestId("user-menu")).toHaveAccessibleName(
      "Cuenta de Patricia Hernán, Propietaria",
    );
  });

  it("closes the side menu when the window grows to desktop, where the sections are always visible and a leftover overlay would block the page", async () => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      media: query,
      matches: false,
      addEventListener: (
        _: string,
        listener: (event: { matches: boolean }) => void,
      ) => listeners.add(listener),
      removeEventListener: (
        _: string,
        listener: (event: { matches: boolean }) => void,
      ) => listeners.delete(listener),
    }));
    renderShell();
    await userEvent.click(screen.getByTestId("nav-toggle"));
    expect(screen.getByRole("dialog", { name: "Menú" })).toBeInTheDocument();

    act(() => {
      for (const listener of listeners) listener({ matches: true });
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Menú" })).toBeNull(),
    );
    vi.unstubAllGlobals();
  });

  it("marks the current section subtly, so the page's primary button stays the only solid olive on screen", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const current = within(nav).getByRole("link", { name: "Especialidades" });
    const other = within(nav).getByRole("link", { name: "Inicio" });

    expect(current).toHaveClass(
      "bg-sage-100",
      "text-sage-900",
      "font-medium",
      "before:w-[3px]",
      "before:bg-sage-800",
    );
    expect(current).not.toHaveClass("bg-sage-800");
    expect(other).not.toHaveClass("bg-sage-100", "before:w-[3px]");
  });

  it("shows each section's icon without adding it to the link name", () => {
    renderShell(undefined, [
      { href: "/team", label: "Equipo", icon: <Users data-testid="icon" /> },
    ]);
    const link = within(
      screen.getByRole("navigation", { name: "Secciones" }),
    ).getByRole("link", { name: "Equipo" });

    expect(within(link).getByTestId("icon")).toBeInTheDocument();
  });

  it("shows how many things are pending in a section and says it in words to screen readers", () => {
    renderShell(undefined, [
      {
        href: "/consentimientos",
        label: "Consentimientos",
        icon: <FileSignature />,
        count: 3,
      },
    ]);
    const link = within(
      screen.getByRole("navigation", { name: "Secciones" }),
    ).getByRole("link", { name: "Consentimientos, 3 pendientes" });

    expect(within(link).getByTestId("nav-count")).toHaveTextContent("3");
  });

  it("hides the counter when nothing is pending, so a zero never asks for attention", () => {
    renderShell(undefined, [{ href: "/cobros", label: "Cobros", count: 0 }]);
    const link = within(
      screen.getByRole("navigation", { name: "Secciones" }),
    ).getByRole("link", { name: "Cobros" });

    expect(within(link).queryByTestId("nav-count")).toBeNull();
  });

  it("keeps icons and counters in the side menu on narrow screens", async () => {
    renderShell(undefined, [
      {
        href: "/consentimientos",
        label: "Consentimientos",
        icon: <FileSignature data-testid="icon" />,
        count: 2,
      },
    ]);
    await userEvent.click(screen.getByTestId("nav-toggle"));
    const link = within(screen.getByRole("dialog", { name: "Menú" })).getByRole(
      "link",
      { name: "Consentimientos, 2 pendientes" },
    );

    expect(within(link).getByTestId("icon")).toBeInTheDocument();
  });

  it("slides the side menu out as well as in, and only fades it for people who reduce motion", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId("nav-toggle"));

    expectExitThatOnlyFadesWithReducedMotion(
      screen.getByRole("dialog", { name: "Menú" }),
    );
  });
});
