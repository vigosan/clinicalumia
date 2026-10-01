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

  it("pads a one-digit day or month when a slash is typed, so 5/3/1990 is 5 March and not 53/19/90", async () => {
    const input = renderInForm();
    await userEvent.type(input, "5/3/1990");

    expect(input).toHaveValue("05/03/1990");
    expect(submittedValues(form())).toEqual({ birth_date: "1990-03-05" });
  });

  it("turns an autofilled ISO date into dd/mm/aaaa", async () => {
    const input = renderInForm();
    await userEvent.click(input);
    await userEvent.paste("1990-01-31");

    expect(input).toHaveValue("31/01/1990");
    expect(submittedValues(form())).toEqual({ birth_date: "1990-01-31" });
  });

  it("explains an invalid date in words once the field is left, not only with a red border", async () => {
    const input = renderInForm();
    await userEvent.type(input, "31021990");
    expect(screen.queryByText(/fecha no válida/i)).not.toBeInTheDocument();

    await userEvent.tab();

    expect(input).toHaveAccessibleDescription(
      "Fecha no válida. Escríbela como 05/03/1990.",
    );
  });

  it("announces the invalid date message as soon as it appears, so a screen reader user hears it", async () => {
    const input = renderInForm();
    await userEvent.type(input, "31021990");
    await userEvent.tab();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fecha no válida. Escríbela como 05/03/1990.",
    );
  });
});
