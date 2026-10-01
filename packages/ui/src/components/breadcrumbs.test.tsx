import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "./breadcrumbs";

const crumbs = [
  { label: "Pacientes", href: "/patients" },
  { label: "Lucía Pérez", href: "/patients/1" },
  { label: "Editar" },
];

describe("Breadcrumbs", () => {
  it("links every level above the current page so staff can go back without the browser", () => {
    render(<Breadcrumbs items={crumbs} />);
    const trail = screen.getByTestId("breadcrumbs");
    expect(
      within(trail).getByRole("link", { name: "Pacientes" }),
    ).toHaveAttribute("href", "/patients");
    expect(
      within(trail).getByRole("link", { name: "Lucía Pérez" }),
    ).toHaveAttribute("href", "/patients/1");
  });

  it("marks the current page without making it a link to itself", () => {
    render(<Breadcrumbs items={crumbs} />);
    const trail = screen.getByTestId("breadcrumbs");
    expect(within(trail).getByText("Editar")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(trail).queryByRole("link", { name: "Editar" }),
    ).not.toBeInTheDocument();
  });

  it("offers a single back link to the parent for the narrow mobile header", () => {
    render(<Breadcrumbs items={crumbs} />);
    const back = screen.getByTestId("breadcrumbs-back");
    expect(back).toHaveAttribute("href", "/patients/1");
    expect(back).toHaveTextContent("Lucía Pérez");
  });
});
