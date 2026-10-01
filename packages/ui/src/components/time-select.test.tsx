import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./field";
import { parseTime, TimeSelect } from "./time-select";

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function form() {
  return screen.getByTestId("form") as HTMLFormElement;
}

function renderInForm(props: Partial<Parameters<typeof TimeSelect>[0]> = {}) {
  render(
    <form data-testid="form">
      <Field label="Hora">
        <TimeSelect name="time" defaultValue="10:00" {...props} />
      </Field>
      <button type="submit">Guardar</button>
    </form>,
  );
  return screen.getByRole("combobox", { name: "Hora" });
}

describe("parseTime", () => {
  it.each([
    ["9", "09:00"],
    ["09", "09:00"],
    ["930", "09:30"],
    ["0930", "09:30"],
    ["9:30", "09:30"],
    ["9.30", "09:30"],
    ["14:05", "14:05"],
    ["23:59", "23:59"],
    ["9,30", "09:30"],
    ["123", "01:23"],
  ])("reads %s as %s, so the time can be typed the way people write it", (text, time) => {
    expect(parseTime(text)).toBe(time);
  });

  it.each([
    "",
    "24:00",
    "9:60",
    "abc",
    "12345",
    "9:3",
  ])("rejects %s", (text) => {
    expect(parseTime(text)).toBeNull();
  });
});

describe("TimeSelect", () => {
  it("sends the time as HH:MM under its name, so server actions keep receiving the same field", async () => {
    const input = renderInForm();
    expect(submittedValues(form())).toEqual({ time: "10:00" });

    await userEvent.click(input);
    await userEvent.click(screen.getByRole("option", { name: "10:45" }));

    expect(submittedValues(form())).toEqual({ time: "10:45" });
    expect(input).toHaveValue("10:45");
  });

  it("offers every quarter of an hour", async () => {
    const input = renderInForm();
    await userEvent.click(input);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(96);
    expect(options.slice(40, 44)).toEqual(["10:00", "10:15", "10:30", "10:45"]);
  });

  it("accepts a typed time outside the quarters, as existing appointments can have one", async () => {
    const onValueChange = vi.fn();
    const input = renderInForm({ onValueChange });
    await userEvent.clear(input);
    await userEvent.type(input, "1420{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith("14:20");
    expect(input).toHaveValue("14:20");
    expect(submittedValues(form())).toEqual({ time: "14:20" });
  });

  it("keeps the typed time when focus leaves the field", async () => {
    const input = renderInForm();
    await userEvent.clear(input);
    await userEvent.type(input, "9.30");
    await userEvent.tab();

    expect(input).toHaveValue("09:30");
    expect(submittedValues(form())).toEqual({ time: "09:30" });
  });

  it("puts the previous time back when the typed text is not a time", async () => {
    const input = renderInForm();
    await userEvent.clear(input);
    await userEvent.type(input, "25:00");
    await userEvent.tab();

    expect(input).toHaveValue("10:00");
    expect(submittedValues(form())).toEqual({ time: "10:00" });
  });

  it("can be used with the keyboard alone: arrows move through the quarters and Enter picks", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const input = renderInForm();
    form().addEventListener("submit", onSubmit);
    input.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "10:00" }).id,
    );

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue("10:30");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
    expect(submittedValues(form())).toEqual({ time: "10:30" });
  });

  it("highlights the first quarter at or after what is being typed", async () => {
    const input = renderInForm();
    await userEvent.clear(input);
    await userEvent.type(input, "11:1");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "11:15" }).id,
    );
  });

  it("closes with Escape and keeps the focus in the field", async () => {
    const input = renderInForm();
    input.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue("10:00");
  });

  it("submits the form with Enter once the time is set and the list is closed", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const input = renderInForm();
    form().addEventListener("submit", onSubmit);
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("goes back to its initial time when the form is reset", async () => {
    const input = renderInForm();
    await userEvent.clear(input);
    await userEvent.type(input, "12{Enter}");
    form().reset();

    await waitFor(() => expect(input).toHaveValue("10:00"));
    expect(submittedValues(form())).toEqual({ time: "10:00" });
  });

  it("puts the previous time back with Escape, so Escape cancels what was typed", async () => {
    const onValueChange = vi.fn();
    const input = renderInForm({ onValueChange });
    await userEvent.clear(input);
    await userEvent.type(input, "1530{Escape}");
    expect(input).toHaveValue("10:00");

    await userEvent.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(submittedValues(form())).toEqual({ time: "10:00" });
  });
});
