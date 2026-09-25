import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";

describe("Field", () => {
  it("connects the label to its control, so clicking or reading the label reaches the input", () => {
    render(
      <Field label="Nombre del servicio">
        <Input name="name" />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre del servicio")).toHaveAttribute(
      "name",
      "name",
    );
  });

  it("announces an error and marks the control invalid, so screen reader users hear what to fix", () => {
    render(
      <Field label="Email" error="El email no es válido.">
        <Input name="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("El email no es válido.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("describes the control with its hint", () => {
    render(
      <Field label="IVA" hint="Los servicios sanitarios van exentos.">
        <Select name="vat">
          <option value="exempt">Exento</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("IVA")).toHaveAccessibleDescription(
      "Los servicios sanitarios van exentos.",
    );
  });

  it("does not mark a valid control as invalid", () => {
    render(
      <Field label="Nombre">
        <Input name="name" />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });
});
