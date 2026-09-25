import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CheckboxField } from "./checkbox-field";

describe("CheckboxField", () => {
  it("toggles the checkbox when the label is clicked, so the whole row is clickable", async () => {
    render(<CheckboxField label="Permitir reserva desde la web" />);
    const checkbox = screen.getByRole("checkbox", {
      name: "Permitir reserva desde la web",
    });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(screen.getByText("Permitir reserva desde la web"));
    expect(checkbox).toBeChecked();
  });

  it("announces the error and links it to the checkbox, so screen reader users hear what to fix", () => {
    render(
      <CheckboxField
        label="Permitir reserva desde la web"
        error="Debes confirmarlo."
      />,
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "Permitir reserva desde la web",
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Debes confirmarlo.");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox.getAttribute("aria-describedby")).toContain(alert.id);
  });
});
