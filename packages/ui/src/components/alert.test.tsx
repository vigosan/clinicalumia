import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";

describe("Alert", () => {
  it("is announced right away, so a screen reader user learns the list did not load", () => {
    render(
      <Alert data-testid="patients-error">
        No se ha podido cargar el listado. Recarga la página.
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "No se ha podido cargar el listado. Recarga la página.",
    );
    expect(alert).toHaveAttribute("data-testid", "patients-error");
  });

  it("can carry a title that sums up the problem before the detail", () => {
    render(
      <Alert title="No se ha podido cargar la cita">Recarga la página.</Alert>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se ha podido cargar la citaRecarga la página.",
    );
  });
});
