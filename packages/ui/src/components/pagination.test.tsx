import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

function hrefFor(page: number) {
  return `/patients?q=garcia&pagina=${page}`;
}

describe("Pagination", () => {
  it("links to the previous and next pages and says where you are", () => {
    render(
      <Pagination
        page={2}
        pageCount={3}
        hrefFor={hrefFor}
        testIdPrefix="patients"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Paginación" });
    expect(nav).toHaveTextContent("Página 2 de 3");
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/patients?q=garcia&pagina=1",
    );
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      "/patients?q=garcia&pagina=3",
    );
    expect(screen.getByTestId("patients-prev")).toBeInTheDocument();
    expect(screen.getByTestId("patients-next")).toBeInTheDocument();
  });

  it("offers no way back on the first page and no way forward on the last, so it never leads to an empty page", () => {
    const { rerender } = render(
      <Pagination page={1} pageCount={3} hrefFor={hrefFor} testIdPrefix="p" />,
    );
    expect(screen.queryByRole("link", { name: "Anterior" })).toBeNull();
    expect(screen.getByRole("link", { name: "Siguiente" })).toBeInTheDocument();

    rerender(
      <Pagination page={3} pageCount={3} hrefFor={hrefFor} testIdPrefix="p" />,
    );
    expect(screen.getByRole("link", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Siguiente" })).toBeNull();
  });

  it("shows nothing when everything fits in one page", () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} hrefFor={hrefFor} testIdPrefix="p" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
