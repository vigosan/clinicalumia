import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SwitchField } from "./switch";

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

describe("SwitchField", () => {
  it("sends «on» under its name only while switched on, like the checkbox it replaces", async () => {
    render(
      <form data-testid="form">
        <SwitchField
          name="is_patient"
          label="También es paciente (recibe tratamiento)"
          defaultChecked
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(submittedValues(form)).toEqual({ is_patient: "on" });

    await userEvent.click(
      screen.getByRole("switch", {
        name: "También es paciente (recibe tratamiento)",
      }),
    );

    expect(submittedValues(form)).toEqual({});
  });

  it("toggles with the Space key and with a click on its label", async () => {
    render(<SwitchField label="También es paciente" />);
    const control = screen.getByRole("switch", { name: "También es paciente" });

    control.focus();
    await userEvent.keyboard(" ");
    expect(control).toBeChecked();

    await userEvent.click(screen.getByText("También es paciente"));
    expect(control).not.toBeChecked();
  });

  it("describes the switch with its hint, so screen readers hear the explanation", () => {
    render(
      <SwitchField
        label="También es paciente"
        hint="Recibe tratamiento en la clínica."
      />,
    );
    expect(screen.getByRole("switch")).toHaveAccessibleDescription(
      "Recibe tratamiento en la clínica.",
    );
  });
});
