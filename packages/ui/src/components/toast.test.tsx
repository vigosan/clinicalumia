import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectExitThatOnlyFadesWithReducedMotion } from "../test/motion";
import { Toaster, toast } from "./toast";

function Register({ message = "Cobro registrado · 45,00 € en efectivo" }) {
  return (
    <button type="button" onClick={() => toast(message)}>
      Registrar
    </button>
  );
}

describe("Toast", () => {
  it("announces the confirmation politely, so screen readers hear it without losing their place", async () => {
    render(
      <>
        <Toaster />
        <Register />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Cobro registrado · 45,00 € en efectivo",
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cobro registrado · 45,00 € en efectivo",
      ),
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("can be closed at once with its button", async () => {
    render(
      <>
        <Toaster />
        <Register />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));

    await waitFor(() => expect(screen.queryByTestId("toast")).toBeNull());
  });

  it("goes away by itself, so it never piles up over the page", async () => {
    render(
      <>
        <Toaster duration={50} />
        <Register />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByTestId("toast")).toBeNull());
  });

  it("shows each new confirmation, one after another", async () => {
    render(
      <>
        <Toaster />
        <Register message="Primero" />
        <Register message="Segundo" />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", {
      name: "Registrar",
    });
    await userEvent.click(first as HTMLElement);
    await userEvent.click(second as HTMLElement);

    expect(screen.getAllByTestId("toast").map((t) => t.textContent)).toEqual([
      expect.stringContaining("Primero"),
      expect.stringContaining("Segundo"),
    ]);
  });

  it("marks a failure as an error with its own look, so it is never mistaken for a confirmation", async () => {
    render(<Toaster />);
    act(() => toast("No se ha podido guardar", { tone: "error" }));

    expect(screen.getByTestId("toast")).toHaveAttribute("data-tone", "error");
    expect(screen.getByTestId("toast-icon")).toHaveClass("text-danger-600");
  });

  it("keeps confirmations as success by default, so existing callers keep their look", async () => {
    render(
      <>
        <Toaster />
        <Register />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(screen.getByTestId("toast")).toHaveAttribute("data-tone", "success");
    expect(screen.getByTestId("toast-icon")).toHaveClass("text-sage-800");
  });

  it("leaves an error on screen longer than a confirmation, so there is time to read what went wrong", async () => {
    render(<Toaster duration={50} />);
    act(() => {
      toast("Guardado");
      toast("No se ha podido guardar", { tone: "error" });
    });

    await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(1));
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "No se ha podido guardar",
    );
  });

  it("runs its action and closes, so «Deshacer» undoes the change in one click", async () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() =>
      toast("Cita marcada como no presentada", {
        action: { label: "Deshacer", onClick: undo },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(undo).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByTestId("toast")).toBeNull());
  });

  it("does not go away by itself while it offers an action, so there is always time to undo", async () => {
    render(<Toaster duration={50} />);
    act(() =>
      toast("Cita marcada como no presentada", {
        action: { label: "Deshacer", onClick: () => {} },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(
      screen.getByRole("button", { name: "Deshacer" }),
    ).toBeInTheDocument();
  });

  it("lets keyboard users reach and use the action without a mouse", async () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() =>
      toast("Cita marcada como no presentada", {
        action: { label: "Deshacer", onClick: undo },
      }),
    );

    await userEvent.tab();
    expect(screen.getByTestId("toast")).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Deshacer" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(undo).toHaveBeenCalledOnce();
  });

  it("slides out when it leaves, and only fades for people who reduce motion", async () => {
    render(
      <>
        <Toaster />
        <Register />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expectExitThatOnlyFadesWithReducedMotion(screen.getByTestId("toast"));
  });
});
