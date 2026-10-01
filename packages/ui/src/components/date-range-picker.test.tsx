import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "./date-range-picker";
import { Field } from "./field";

const PRESETS = [
  { key: "hoy", label: "Hoy", from: "2026-10-26", to: "2026-10-26" },
  { key: "ayer", label: "Ayer", from: "2026-10-25", to: "2026-10-25" },
  { key: "semana", label: "Esta semana", from: "2026-10-26", to: "2026-11-01" },
  { key: "mes", label: "Este mes", from: "2026-10-01", to: "2026-10-31" },
];

function day(iso: string) {
  return within(
    document.querySelector(`[data-day="${iso}"]`) as HTMLElement,
  ).getByRole("button");
}

function renderPicker(onChange = vi.fn()) {
  render(
    <Field label="Fechas">
      <DateRangePicker
        from="2026-10-05"
        to="2026-10-09"
        today="2026-10-26"
        presets={PRESETS}
        onChange={onChange}
        data-testid="range"
      />
    </Field>,
  );
  return onChange;
}

describe("DateRangePicker", () => {
  it("shows the chosen range in Spanish on the trigger", () => {
    renderPicker();
    expect(screen.getByRole("combobox", { name: "Fechas" })).toHaveTextContent(
      "5 oct 2026 – 9 oct 2026",
    );
  });

  it("applies a preset in one click, so common ranges need no calendar work", async () => {
    const onChange = renderPicker();
    await userEvent.click(screen.getByRole("combobox", { name: "Fechas" }));
    await userEvent.click(screen.getByTestId("range-preset-ayer"));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-10-25",
      to: "2026-10-25",
    });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("offers Hoy, Ayer, Esta semana and Este mes", async () => {
    renderPicker();
    await userEvent.click(screen.getByRole("combobox", { name: "Fechas" }));
    for (const label of ["Hoy", "Ayer", "Esta semana", "Este mes"])
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });

  it("picks a range with two clicks, whichever end is clicked first", async () => {
    const onChange = renderPicker();
    await userEvent.click(screen.getByRole("combobox", { name: "Fechas" }));
    await userEvent.click(day("2026-10-20"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Elige el último día")).toBeInTheDocument();
    await userEvent.click(day("2026-10-12"));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-10-12",
      to: "2026-10-20",
    });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("picks a single day by clicking it twice", async () => {
    const onChange = renderPicker();
    await userEvent.click(screen.getByRole("combobox", { name: "Fechas" }));
    await userEvent.click(day("2026-10-25"));
    await userEvent.click(day("2026-10-25"));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-10-25",
      to: "2026-10-25",
    });
  });

  it("can be used with the keyboard alone", async () => {
    const onChange = renderPicker();
    screen.getByRole("combobox", { name: "Fechas" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(day("2026-10-05")).toHaveFocus();

    await userEvent.keyboard("{Enter}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-10-05",
      to: "2026-10-26",
    });
    expect(screen.getByRole("combobox", { name: "Fechas" })).toHaveFocus();
  });

  it("keeps the range when closed with Escape halfway", async () => {
    const onChange = renderPicker();
    screen.getByRole("combobox", { name: "Fechas" }).focus();
    await userEvent.keyboard("{Enter}{ArrowRight}{Enter}{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Fechas" })).toHaveTextContent(
      "5 oct 2026 – 9 oct 2026",
    );
  });

  it("is in Spanish and starts the week on Monday", async () => {
    renderPicker();
    await userEvent.click(screen.getByRole("combobox", { name: "Fechas" }));
    const headers = [...screen.getByRole("grid").querySelectorAll("th")].map(
      (header) => header.textContent,
    );
    expect(headers[0]).toMatch(/^lu/i);
    expect(document.querySelector('[data-day="2026-10-26"]')).toHaveAttribute(
      "data-today",
    );
  });
});
