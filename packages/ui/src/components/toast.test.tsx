import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
