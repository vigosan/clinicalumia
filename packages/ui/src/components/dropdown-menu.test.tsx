import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { expectExitThatOnlyFadesWithReducedMotion } from "../test/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("animates out as well as in, and only fades for people who reduce motion", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Opciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Opciones" }));

    expectExitThatOnlyFadesWithReducedMotion(screen.getByRole("menu"));
  });
});
