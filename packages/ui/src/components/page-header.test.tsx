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
});
