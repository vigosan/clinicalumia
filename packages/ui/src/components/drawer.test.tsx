import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { expectExitThatOnlyFadesWithReducedMotion } from "../test/motion";
import { Drawer, DrawerClose } from "./drawer";

function Example() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-appointment="a1">
        Elena · 10:00
      </button>
      <Drawer
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
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("keeps its trigger disabled in the server HTML and enables it once hydrated, so a click that could not open the drawer is never silently lost", async () => {
    const drawer = (
      <Drawer
        trigger={<button type="button">Cobrar</button>}
        title="Registrar cobro"
        description="Elena Ruiz"
      >
        <p>Formulario</p>
      </Drawer>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(drawer);
    document.body.appendChild(container);
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeDisabled();

    render(drawer, { container, hydrate: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cobrar" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(
      screen.getByRole("dialog", { name: "Registrar cobro" }),
    ).toBeVisible();
  });

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
  it("opens from its trigger and gives the focus back to it on close, so the keyboard user continues where they were", async () => {
    render(
      <Drawer
        trigger={<button type="button">Editar</button>}
        title="Editar especialidad"
        description="Logopedia"
      >
        <input aria-label="Nombre" />
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("dialog", { name: "Editar especialidad" }),
    ).toHaveAccessibleDescription("Logopedia");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Editar" })).toHaveFocus();
  });

  it("slides out as well as in, and only fades for people who reduce motion", () => {
    render(<Example />);

    expectExitThatOnlyFadesWithReducedMotion(screen.getByRole("dialog"));
  });

  it("places header actions beside the close button, so moving between records stays in the same corner as closing", () => {
    render(
      <Drawer
        open
        title="Elena Ruiz"
        description="Valoración inicial"
        actions={<button type="button">Cita siguiente</button>}
      >
        <p>Detalle</p>
      </Drawer>,
    );

    const next = screen.getByRole("button", { name: "Cita siguiente" });
    const close = screen.getByRole("button", { name: "Cerrar" });
    expect(next.parentElement).toBe(close.parentElement);
    expect(
      next.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("with a prominent title puts the title before the description, so a record reads by who it is before the details", () => {
    render(
      <Drawer
        open
        prominent
        title="Elena Ruiz"
        description="Valoración inicial"
      >
        <p>Detalle</p>
      </Drawer>,
    );

    const title = screen.getByRole("heading", { name: "Elena Ruiz" });
    const description = screen.getByText("Valoración inicial");
    expect(
      title.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Valoración inicial",
    );
  });

  it("lets a form inside offer its own «Cancelar» that closes the drawer, so cancelling never needs a trip to another page", async () => {
    function WithCancel() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Nuevo paciente"
          description="Pacientes"
        >
          <DrawerClose asChild>
            <button type="button">Cancelar</button>
          </DrawerClose>
        </Drawer>
      );
    }
    render(<WithCancel />);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
