import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchInput } from "./search-input";

describe("SearchInput", () => {
  it("is announced as a search with its name even though no label is shown, so screen readers still know what it searches", () => {
    render(<SearchInput aria-label="Buscar pacientes" />);

    expect(
      screen.getByRole("searchbox", { name: "Buscar pacientes" }),
    ).toBeInTheDocument();
  });

  it("shows what can be typed as the placeholder, since the visible label is gone", () => {
    render(
      <SearchInput
        aria-label="Buscar pacientes"
        placeholder="Nombre, DNI, teléfono o email"
      />,
    );

    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Nombre, DNI, teléfono o email",
    );
  });
});
