import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "active", label: "Activos", testId: "status-active" },
  { value: "archived", label: "Archivados", testId: "status-archived" },
];

function Filter({
  onValueChange,
}: {
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("active");
  return (
    <SegmentedControl
      aria-label="Fichas"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      options={OPTIONS}
    />
  );
}

describe("SegmentedControl", () => {
  it("shows exactly one choice as selected, so the list never ends up without a filter", async () => {
    render(<Filter />);
    expect(
      screen.getByRole("radiogroup", { name: "Fichas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Activos" })).toBeChecked();

    await userEvent.click(screen.getByTestId("status-archived"));
    await userEvent.click(screen.getByTestId("status-archived"));

    expect(screen.getByRole("radio", { name: "Archivados" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Activos" })).not.toBeChecked();
  });

  it("moves between choices with the arrow keys and applies them at once", async () => {
    const onValueChange = vi.fn();
    render(<Filter onValueChange={onValueChange} />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Activos" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight>}{/ArrowRight}");

    expect(screen.getByRole("radio", { name: "Archivados" })).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("archived");
  });
});
