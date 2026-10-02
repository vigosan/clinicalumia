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

  it("keeps the description right under the title and the actions after both, so on a phone the buttons never split the title from its description", () => {
    render(
      <PageHeader
        title="Nora Ferrer"
        description="12 años · Paciente"
        actions={<button type="button">Editar</button>}
      />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    const description = screen.getByText("12 años · Paciente");
    const action = screen.getByRole("button", { name: "Editar" });
    expect(heading.parentElement).toContainElement(description);
    expect(heading.parentElement).not.toContainElement(action);
    expect(
      description.compareDocumentPosition(action) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
