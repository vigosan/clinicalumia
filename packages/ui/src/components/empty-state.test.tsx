import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("says why the list is empty and offers the next step, so the screen is never a dead end", () => {
    render(
      <EmptyState
        data-testid="patients-empty"
        title="Todavía no hay pacientes."
        description="Crea la primera ficha para dar citas."
        action={<a href="/patients/new">Nuevo paciente</a>}
      />,
    );

    const empty = screen.getByTestId("patients-empty");
    expect(empty).toHaveTextContent("Todavía no hay pacientes.");
    expect(empty).toHaveTextContent("Crea la primera ficha para dar citas.");
    expect(
      screen.getByRole("link", { name: "Nuevo paciente" }),
    ).toHaveAttribute("href", "/patients/new");
  });

  it("is not announced as an error, as an empty list is a normal state", () => {
    render(<EmptyState title="No hay facturas con estos filtros." />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByText("No hay facturas con estos filtros."),
    ).toBeInTheDocument();
  });
});
