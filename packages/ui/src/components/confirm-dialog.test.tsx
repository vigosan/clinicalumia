import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
