import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, type NavItem } from "./app-shell";

const pathname = vi.hoisted(() => ({ current: "/specialties" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const nav: NavItem[] = [
  { href: "/", label: "Inicio", match: ["/appointments"] },
  { href: "/specialties", label: "Especialidades" },
];

function renderShell(logout = vi.fn(async () => {})) {
  render(
    <AppShell
      logo={<span>LUMIA</span>}
      section="Administración"
      nav={nav}
      user={{ name: "Patricia Hernán", detail: "Propietaria" }}
      menu={[
        {
          href: "/mi-calendario",
          label: "Ver citas en mi móvil",
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
});
