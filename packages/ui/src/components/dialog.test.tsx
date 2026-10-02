import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectExitThatOnlyFadesWithReducedMotion } from "../test/motion";
import { Button } from "./button";
import { Dialog } from "./dialog";

function Example() {
  return (
    <Dialog
      trigger={<Button>Registrar cobro</Button>}
      title="Registrar cobro"
      description="Elige la cita que quieres cobrar."
      data-testid="register-dialog"
    >
      <input aria-label="Buscar paciente" />
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is named by its title and described by its description", async () => {
    render(<Example />);
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar cobro" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Registrar cobro" });
    expect(dialog).toHaveAccessibleDescription(
      "Elige la cita que quieres cobrar.",
    );
    expect(dialog).toHaveAttribute("data-testid", "register-dialog");
  });

  it("moves focus inside and keeps it there while open", async () => {
    render(<Example />);
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar cobro" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes with Escape and gives focus back to the button that opened it", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Registrar cobro" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("closes with its close button", async () => {
    render(<Example />);
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar cobro" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("animates out as well as in, and only fades for people who reduce motion", async () => {
    render(<Example />);
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar cobro" }),
    );

    expectExitThatOnlyFadesWithReducedMotion(screen.getByRole("dialog"));
  });
});
