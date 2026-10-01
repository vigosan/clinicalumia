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

  it("can warn without alarming: a warning is a polite status, not an assertive alert", () => {
    render(
      <Alert tone="warning" data-testid="quarter-current">
        Trimestre en curso: los datos pueden cambiar.
      </Alert>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Trimestre en curso: los datos pueden cambiar.",
    );
    expect(status.className).toContain("bg-warning-100");
    expect(status.className).not.toContain("danger");
  });

  it("stays a danger alert by default, so existing error notices keep interrupting", () => {
    render(<Alert>Algo ha fallado.</Alert>);

    expect(screen.getByRole("alert").className).toContain("bg-danger-100");
  });
});
