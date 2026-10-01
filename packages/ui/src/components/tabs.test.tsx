import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function CobrosTabs() {
  return (
    <Tabs defaultValue="cobrados">
      <TabsList aria-label="Cobros">
        <TabsTrigger value="cobrados">Cobrados</TabsTrigger>
        <TabsTrigger value="pendientes">Pendientes (3)</TabsTrigger>
      </TabsList>
      <TabsContent value="cobrados">Lista de cobros</TabsContent>
      <TabsContent value="pendientes">Lista de pendientes</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows only the panel of the selected tab", async () => {
    render(<CobrosTabs />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Lista de cobros");

    await userEvent.click(screen.getByRole("tab", { name: "Pendientes (3)" }));

    expect(screen.getByRole("tab", { name: "Pendientes (3)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Lista de pendientes",
    );
  });

  it("switches tabs with the arrow keys", async () => {
    render(<CobrosTabs />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Cobrados" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Pendientes (3)" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Lista de pendientes",
    );
  });
});
