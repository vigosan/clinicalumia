import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table";

describe("Table", () => {
  it("keeps real table semantics, so assistive technology can read cells with their column headers", () => {
    render(
      <Table aria-label="Facturas">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nº</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>2026-0148</TableCell>
            <TableCell>40,00 €</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Facturas" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Nº", "Total"]);
    expect(
      within(table).getByRole("cell", { name: "40,00 €" }),
    ).toBeInTheDocument();
  });
});
