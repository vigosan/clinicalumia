import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioCards } from "./radio-cards";

const METHODS = [
  { value: "cash", label: "Efectivo", testId: "method-cash" },
  { value: "card", label: "Tarjeta", testId: "method-card" },
  { value: "bizum", label: "Bizum", testId: "method-bizum" },
];

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

describe("RadioCards", () => {
  it("sends the chosen card under its name, so a payment never goes without its method", async () => {
    render(
      <form data-testid="form">
        <RadioCards
          name="method"
          label="Forma de pago"
          defaultValue="cash"
          options={METHODS}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(submittedValues(form)).toEqual({ method: "cash" });

    await userEvent.click(screen.getByTestId("method-card"));

    expect(submittedValues(form)).toEqual({ method: "card" });
  });

  it("is a labelled radio group navigable with the arrow keys", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioCards
        label="Forma de pago"
        defaultValue="cash"
        options={METHODS}
        onValueChange={onValueChange}
      />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Forma de pago" }),
    ).toBeInTheDocument();

    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Efectivo" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown>}{/ArrowDown}");

    expect(screen.getByRole("radio", { name: "Tarjeta" })).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("card");
  });

  it("includes the description in the option's accessible description", () => {
    render(
      <RadioCards
        label="¿Quién cancela?"
        defaultValue="patient"
        options={[
          {
            value: "patient",
            label: "El paciente",
            description: "Cuenta como cancelación del paciente.",
          },
          { value: "clinic", label: "La clínica" },
        ]}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "El paciente" }),
    ).toHaveAccessibleDescription("Cuenta como cancelación del paciente.");
  });
});
