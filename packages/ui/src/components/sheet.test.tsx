import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Sheet } from "./sheet";

function Example() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-appointment="a1">
        Elena · 10:00
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Elena Ruiz"
        description="Lunes 5 de octubre · 10:00 – 11:00"
        data-testid="appointment-panel"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document
            .querySelector<HTMLElement>('[data-appointment="a1"]')
            ?.focus();
        }}
      >
        <button type="button">Cobrar</button>
        <button type="button">Cancelar cita</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("is a dialog named by its title and described by its description", () => {
    render(<Example />);

    const sheet = screen.getByRole("dialog", { name: "Elena Ruiz" });
    expect(sheet).toHaveAccessibleDescription(
      "Lunes 5 de octubre · 10:00 – 11:00",
    );
    expect(sheet).toHaveAttribute("data-testid", "appointment-panel");
  });

  it("keeps the focus inside while open, so keyboard users do not wander into the page behind", async () => {
    render(<Example />);
    const sheet = screen.getByRole("dialog");

    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(sheet).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes with Escape and lets the caller send focus back to what opened it", async () => {
    render(<Example />);
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Elena · 10:00" })).toHaveFocus();
  });

  it("closes with its close button", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
