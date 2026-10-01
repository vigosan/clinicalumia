import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

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
        <Select
          name="vat"
          defaultValue="exempt"
          options={[{ value: "exempt", label: "Exento" }]}
        />
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

  it("keeps the control's own id instead of replacing it with a generated one", () => {
    render(
      <Field label="Nombre">
        <Input name="name" id="custom-id" />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("id", "custom-id");
  });

  it("connects the label to a Textarea, so a multiline field is reachable the same way", () => {
    render(
      <Field label="Pie de factura">
        <Textarea name="invoice_footer" />
      </Field>,
    );
    expect(screen.getByLabelText("Pie de factura")).toHaveAttribute(
      "name",
      "invoice_footer",
    );
  });

  it("merges the control's own aria-describedby with the hint instead of overwriting it", () => {
    render(
      <Field label="Nombre" hint="Ayuda">
        <Input name="name" aria-describedby="external-help" />
      </Field>,
    );
    const input = screen.getByLabelText("Nombre");
    const describedBy = input.getAttribute("aria-describedby")?.split(" ");
    expect(describedBy).toContain("external-help");
    expect(input).toHaveAccessibleDescription("Ayuda");
  });
});
