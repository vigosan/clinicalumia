import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("shows the eyebrow above the title, so a page whose title is a date still says which section it is", () => {
    render(<PageHeader eyebrow="Agenda" title="Lunes, 5 de octubre" />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Lunes, 5 de octubre",
    });
    const eyebrow = screen.getByText("Agenda");
    expect(
      eyebrow.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lets a detail page tag its title, so the title is the one place that names the record", () => {
    render(<PageHeader title="Factura 34/26" titleTestId="invoice-code" />);

    expect(screen.getByTestId("invoice-code")).toEqual(
      screen.getByRole("heading", { level: 1, name: "Factura 34/26" }),
    );
  });

  it("keeps the actions on the title's line, so the main button sits at the same height on every page whether or not it has a description", () => {
    render(
      <PageHeader
        title="Cobros"
        description="Dinero recibido por las citas."
        actions={<button type="button">Registrar cobro</button>}
      />,
    );

    const titleRow = screen.getByRole("heading", { level: 1 }).parentElement;
    expect(titleRow).toContainElement(
      screen.getByRole("button", { name: "Registrar cobro" }),
    );
    expect(titleRow).not.toContainElement(
      screen.getByText("Dinero recibido por las citas."),
    );
  });
});
