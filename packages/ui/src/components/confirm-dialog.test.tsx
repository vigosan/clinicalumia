import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

function renderDialog(onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      trigger={<Button variant="danger">Eliminar</Button>}
      title="¿Eliminar Logopedia?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("ConfirmDialog", () => {
  it("asks before a destructive action instead of acting on the first click", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(
      screen.getByRole("alertdialog", { name: "¿Eliminar Logopedia?" }),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action once when confirmed and closes", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByTestId("confirm-action"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does nothing when cancelled or dismissed with Escape", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.keyboard("{Escape}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("disables the confirm button while the action is running, so a double click never runs it twice", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button variant="danger">Cambiar</Button>}
        title="¿Cambiar el enlace?"
        description="El enlace actual dejará de funcionar."
        confirmLabel="Cambiando…"
        closeOnConfirm={false}
        confirmDisabled
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    expect(screen.getByTestId("confirm-action")).toBeDisabled();
    await userEvent.click(screen.getByTestId("confirm-action"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renders extra content between the description and the action buttons", async () => {
    render(
      <ConfirmDialog
        trigger={<Button variant="danger">Eliminar</Button>}
        title="¿Eliminar Logopedia?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={vi.fn()}
      >
        <p>Campo extra</p>
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText("Campo extra")).toBeInTheDocument();
  });

  it("uses a custom confirmTestId when given, keeping the default otherwise", async () => {
    render(
      <ConfirmDialog
        trigger={<Button variant="danger">Eliminar</Button>}
        title="¿Eliminar Logopedia?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmTestId="custom-confirm"
        onConfirm={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByTestId("custom-confirm")).toBeInTheDocument();
    expect(screen.queryByTestId("confirm-action")).not.toBeInTheDocument();
  });

  it("with closeOnConfirm={false}, runs the action but leaves the dialog open for the caller to close", async () => {
    const onConfirm = vi.fn();
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <ConfirmDialog
          trigger={<Button variant="danger">Eliminar</Button>}
          title="¿Eliminar Logopedia?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          open={open}
          onOpenChange={setOpen}
          closeOnConfirm={false}
          onConfirm={onConfirm}
        />
      );
    }
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByTestId("confirm-action"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes once an async onConfirm resolves and the caller sets open to false, as an async cancel flow would", async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false);
      async function handleConfirm() {
        await Promise.resolve();
        setOpen(false);
      }
      return (
        <ConfirmDialog
          trigger={<Button variant="danger">Eliminar</Button>}
          title="¿Eliminar Logopedia?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          open={open}
          onOpenChange={setOpen}
          closeOnConfirm={false}
          onConfirm={handleConfirm}
        />
      );
    }
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByTestId("confirm-action"));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("keeps red for destructive actions only, so a reversible step like archiving does not look alarming", async () => {
    render(
      <>
        <ConfirmDialog
          trigger={<Button variant="secondary">Archivar</Button>}
          title="¿Archivar esta ficha?"
          description="Podrás desarchivarla."
          confirmLabel="Archivar"
          confirmTestId="archive-confirm"
          onConfirm={vi.fn()}
        />
        <ConfirmDialog
          trigger={<Button variant="danger">Eliminar</Button>}
          title="¿Eliminar esta ficha?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          confirmTestId="delete-confirm"
          tone="destructive"
          onConfirm={vi.fn()}
        />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(screen.getByTestId("archive-confirm")).toHaveAttribute(
      "data-variant",
      "primary",
    );
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByTestId("delete-confirm")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });
});
