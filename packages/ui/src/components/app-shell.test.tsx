import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/specialties" }));

describe("AppShell", () => {
  it("shows the sections, marks where you are, and keeps the page content in the main landmark", () => {
    render(
      <AppShell
        logo={<span>LUMIA</span>}
        section="Administración"
        nav={[
          { href: "/", label: "Inicio" },
          { href: "/specialties", label: "Especialidades" },
        ]}
        user={{ name: "Patricia Hernán", detail: "Propietaria" }}
        logout={<button type="submit">Salir</button>}
      >
        <h1>Especialidades</h1>
      </AppShell>,
    );
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
    expect(screen.getByText("Patricia Hernán")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
  });
});
