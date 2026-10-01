import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";
import { Field } from "./field";

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function form() {
  return screen.getByTestId("form") as HTMLFormElement;
}

function day(iso: string) {
  return within(
    document.querySelector(`[data-day="${iso}"]`) as HTMLElement,
  ).getByRole("button");
}

describe("DatePicker", () => {
  it("sends the date as YYYY-MM-DD under its name, so server actions keep receiving the same field", async () => {
    render(
      <form data-testid="form">
        <Field label="Fecha">
          <DatePicker
            name="date"
            defaultValue="2026-10-05"
            today="2026-10-01"
            data-testid="date"
          />
        </Field>
      </form>,
    );
    expect(submittedValues(form())).toEqual({ date: "2026-10-05" });

    await userEvent.click(screen.getByRole("combobox", { name: "Fecha" }));
    await userEvent.click(day("2026-10-14"));

    expect(submittedValues(form())).toEqual({ date: "2026-10-14" });
    expect(screen.getByTestId("date")).toHaveTextContent("mié, 14 oct 2026");
  });

  it("is in Spanish and starts the week on Monday, as the clinic reads a calendar", async () => {
    render(
      <DatePicker
        aria-label="Fecha"
        defaultValue="2026-10-05"
        today="2026-10-01"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Fecha" }));

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAccessibleName(/octubre 2026/i);
    const headers = [...grid.querySelectorAll("th")].map(
      (header) => header.textContent,
    );
    expect(headers[0]).toMatch(/^lu/i);
    expect(headers[6]).toMatch(/^do/i);
    expect(
      screen.getByRole("button", { name: /mes siguiente/i }),
    ).toBeInTheDocument();
  });

  it("marks today in Madrid, not the browser's day", async () => {
    render(
      <DatePicker
        aria-label="Fecha"
        defaultValue="2026-10-05"
        today="2026-10-02"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Fecha" }));

    expect(document.querySelector('[data-day="2026-10-02"]')).toHaveAttribute(
      "data-today",
    );
  });

  it("can be used with the keyboard alone: open, move with arrows and pick with Enter", async () => {
    const onValueChange = vi.fn();
    render(
      <form data-testid="form">
        <DatePicker
          name="date"
          aria-label="Fecha"
          defaultValue="2026-10-05"
          today="2026-10-01"
          onValueChange={onValueChange}
        />
      </form>,
    );
    screen.getByRole("combobox", { name: "Fecha" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(day("2026-10-05")).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith("2026-10-13");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fecha" })).toHaveFocus();
    expect(submittedValues(form())).toEqual({ date: "2026-10-13" });
  });

  it("closes with Escape without changing the date, so a slip of the hand is harmless", async () => {
    const onValueChange = vi.fn();
    render(
      <DatePicker
        aria-label="Fecha"
        defaultValue="2026-10-05"
        today="2026-10-01"
        onValueChange={onValueChange}
      />,
    );
    screen.getByRole("combobox", { name: "Fecha" }).focus();
    await userEvent.keyboard("{Enter}{ArrowRight}{Escape}");

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Fecha" })).toHaveFocus();
  });

  it("picks the days when the clocks change in Madrid as plain calendar days", async () => {
    render(
      <form data-testid="form">
        <DatePicker
          name="date"
          aria-label="Fecha"
          defaultValue="2026-03-28"
          today="2026-03-28"
        />
      </form>,
    );
    const trigger = screen.getByRole("combobox", { name: "Fecha" });

    await userEvent.click(trigger);
    const march = [...document.querySelectorAll("[data-day^='2026-03-']")]
      .filter((cell) => !cell.hasAttribute("data-outside"))
      .map((cell) => cell.getAttribute("data-day"));
    expect(march).toHaveLength(31);
    expect(new Set(march).size).toBe(31);
    await userEvent.click(day("2026-03-29"));
    expect(submittedValues(form())).toEqual({ date: "2026-03-29" });

    trigger.focus();
    await userEvent.keyboard("{Enter}{ArrowRight}{Enter}");
    expect(submittedValues(form())).toEqual({ date: "2026-03-30" });
  });

  it("moves across the autumn clock change with the keyboard without skipping or repeating a day", async () => {
    render(
      <form data-testid="form">
        <DatePicker
          name="date"
          aria-label="Fecha"
          defaultValue="2026-10-24"
          today="2026-10-01"
        />
      </form>,
    );
    screen.getByRole("combobox", { name: "Fecha" }).focus();
    await userEvent.keyboard("{Enter}{ArrowRight}{Enter}");
    expect(submittedValues(form())).toEqual({ date: "2026-10-25" });

    await userEvent.keyboard("{Enter}{ArrowRight}{Enter}");
    expect(submittedValues(form())).toEqual({ date: "2026-10-26" });
  });

  it("goes back to its initial date when the form is reset", async () => {
    render(
      <form data-testid="form">
        <DatePicker
          name="starts_on"
          aria-label="Desde"
          defaultValue=""
          today="2026-10-01"
        />
      </form>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Desde" }));
    await userEvent.click(day("2026-10-08"));
    expect(submittedValues(form())).toEqual({ starts_on: "2026-10-08" });

    form().reset();

    expect(await screen.findByText("Elige una fecha")).toBeInTheDocument();
    expect(submittedValues(form())).toEqual({ starts_on: "" });
  });

  it("blocks submitting a required empty date, as the native field did", async () => {
    render(
      <form data-testid="form">
        <DatePicker
          name="starts_on"
          aria-label="Desde"
          required
          today="2026-10-01"
        />
      </form>,
    );
    expect(form().checkValidity()).toBe(false);

    await userEvent.click(screen.getByRole("combobox", { name: "Desde" }));
    await userEvent.click(day("2026-10-08"));

    expect(form().checkValidity()).toBe(true);
  });

  it("sends a keyboard user back to the first missing date, the visible field, with a message", async () => {
    render(
      <form data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field label="Desde">
          <DatePicker name="starts_on" required today="2026-10-01" />
        </Field>
        <Field label="Hasta">
          <DatePicker name="ends_on" required today="2026-10-01" />
        </Field>
      </form>,
    );
    const trigger = screen.getByRole("combobox", { name: "Desde" });
    expect(trigger).toHaveAttribute("aria-required", "true");

    act(() => form().requestSubmit());

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription("Elige una fecha");
    expect(screen.getByRole("combobox", { name: "Hasta" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await userEvent.click(trigger);
    await userEvent.click(day("2026-10-08"));

    expect(trigger).not.toHaveAttribute("aria-invalid", "true");
    expect(trigger).not.toHaveAccessibleDescription("Elige una fecha");
  });
});
