import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("does not run its action while disabled, so a pending form cannot be sent twice", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("can render a link with the button look, keeping link semantics for navigation", () => {
    render(
      <Button asChild>
        <a href="/team">Equipo</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Equipo" })).toHaveAttribute(
      "href",
      "/team",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("submits the surrounding form by default, like a native button", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button>Enviar</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
