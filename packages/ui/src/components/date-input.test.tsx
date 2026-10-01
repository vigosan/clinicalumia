import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DateInput } from "./date-input";
import { Field } from "./field";

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function form() {
  return screen.getByTestId("form") as HTMLFormElement;
}

function renderInForm(defaultValue = "") {
  render(
    <form data-testid="form">
      <Field label="Fecha de nacimiento">
        <DateInput
          name="birth_date"
          defaultValue={defaultValue}
          max="2026-10-01"
        />
      </Field>
    </form>,
  );
  return screen.getByLabelText("Fecha de nacimiento");
}

describe("DateInput", () => {
  it("shows a stored date as dd/mm/aaaa and sends it back as YYYY-MM-DD under its name", () => {
    const input = renderInForm("1990-04-12");
    expect(input).toHaveValue("12/04/1990");
    expect(submittedValues(form())).toEqual({ birth_date: "1990-04-12" });
  });

  it("adds the slashes while typing, so a birth date is just eight digits", async () => {
    const input = renderInForm();
    await userEvent.type(input, "05031985");

    expect(input).toHaveValue("05/03/1985");
    expect(submittedValues(form())).toEqual({ birth_date: "1985-03-05" });
    expect(form().checkValidity()).toBe(true);
  });

  it("can be left empty, as the birth date is optional", () => {
    renderInForm();
    expect(submittedValues(form())).toEqual({ birth_date: "" });
    expect(form().checkValidity()).toBe(true);
  });

  it.each([
    ["31021990", "a day that does not exist"],
    ["29022023", "29 February in a common year"],
    ["12131990", "month 13"],
    ["000190", "an unfinished date"],
    ["01012027", "a date after today"],
    ["01011850", "a year before 1900"],
  ])("blocks submitting %s (%s) instead of saving a wrong birth date", async (digits) => {
    const input = renderInForm("1990-04-12");
    await userEvent.clear(input);
    await userEvent.type(input, digits);

    expect(form().checkValidity()).toBe(false);
    expect(submittedValues(form())).toEqual({ birth_date: "" });
    await userEvent.tab();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("accepts 29 February in a leap year", async () => {
    const input = renderInForm();
    await userEvent.type(input, "29022024");
    expect(form().checkValidity()).toBe(true);
    expect(submittedValues(form())).toEqual({ birth_date: "2024-02-29" });
  });
});
