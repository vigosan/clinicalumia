import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./field";
import { Select } from "./select";

const SERVICES = [
  { value: "logo", label: "Logopedia" },
  { value: "fisio", label: "Fisioterapia" },
  { value: "psico", label: "Psicología" },
];

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

describe("Select", () => {
  it("sends the chosen value under its name, so server actions keep receiving the same field", async () => {
    render(
      <form data-testid="form">
        <Field label="Servicio">
          <Select
            name="service_id"
            placeholder="Elige un servicio"
            options={SERVICES}
            data-testid="service"
          />
        </Field>
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(submittedValues(form)).toEqual({ service_id: "" });

    await userEvent.click(screen.getByTestId("service"));
    await userEvent.click(screen.getByRole("option", { name: "Fisioterapia" }));

    expect(submittedValues(form)).toEqual({ service_id: "fisio" });
  });

  it("is reachable from its label and shows the placeholder until something is chosen", () => {
    render(
      <Field label="Servicio">
        <Select placeholder="Elige un servicio" options={SERVICES} />
      </Field>,
    );
    expect(
      screen.getByRole("combobox", { name: "Servicio" }),
    ).toHaveTextContent("Elige un servicio");
  });

  it("can be operated with the keyboard alone: open, move with arrows and pick with Enter", async () => {
    const onValueChange = vi.fn();
    render(
      <form data-testid="form">
        <Select
          name="service_id"
          aria-label="Servicio"
          defaultValue="logo"
          options={SERVICES}
          onValueChange={onValueChange}
        />
      </form>,
    );
    screen.getByRole("combobox", { name: "Servicio" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith("psico");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Servicio" })).toHaveFocus();
    expect(
      submittedValues(screen.getByTestId("form") as HTMLFormElement),
    ).toEqual({ service_id: "psico" });
  });

  it("closes with Escape without changing the value, so a slip of the hand is harmless", async () => {
    const onValueChange = vi.fn();
    render(
      <Select
        aria-label="Servicio"
        defaultValue="logo"
        options={SERVICES}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Servicio" }));
    await userEvent.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveTextContent("Logopedia");
  });

  it("marks the chosen option as selected, so staff can see what is set when reopening", async () => {
    render(
      <Select aria-label="Servicio" defaultValue="fisio" options={SERVICES} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Servicio" }));
    expect(
      screen.getByRole("option", { name: "Fisioterapia" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("supports an empty value as a real option, like «Todo el equipo» in the filters", async () => {
    function Filter() {
      const [value, setValue] = useState("ana");
      return (
        <>
          <Select
            aria-label="Profesional"
            value={value}
            onValueChange={setValue}
            options={[
              { value: "", label: "Todo el equipo" },
              { value: "ana", label: "Ana" },
            ]}
          />
          <output data-testid="value">{`[${value}]`}</output>
        </>
      );
    }
    render(<Filter />);
    await userEvent.click(
      screen.getByRole("combobox", { name: "Profesional" }),
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Todo el equipo" }),
    );

    expect(screen.getByTestId("value")).toHaveTextContent("[]");
    expect(screen.getByRole("combobox")).toHaveTextContent("Todo el equipo");
  });

  it("goes back to its default value when the form is reset, so an invite form starts clean", async () => {
    render(
      <form data-testid="form">
        <Select
          name="specialty_id"
          aria-label="Especialidad"
          defaultValue=""
          options={[
            { value: "", label: "Sin asignar" },
            { value: "logo", label: "Logopedia" },
          ]}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    await userEvent.click(
      screen.getByRole("combobox", { name: "Especialidad" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "Logopedia" }));
    expect(submittedValues(form)).toEqual({ specialty_id: "logo" });

    form.reset();

    expect(await screen.findByRole("combobox")).toHaveTextContent(
      "Sin asignar",
    );
    expect(submittedValues(form)).toEqual({ specialty_id: "" });
  });

  it("gives each option a test id with its value, so e2e tests can pick by id", async () => {
    render(<Select aria-label="Servicio" options={SERVICES} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Servicio" }));
    expect(screen.getByTestId("option-psico")).toHaveTextContent("Psicología");
  });

  it("blocks the submit while a required select has nothing chosen, so a service is never saved without its specialty", async () => {
    render(
      <form data-testid="form">
        <Select
          name="specialty_id"
          aria-label="Especialidad"
          placeholder="Elige una especialidad"
          required
          options={SERVICES}
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);

    await userEvent.click(
      screen.getByRole("combobox", { name: "Especialidad" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "Logopedia" }));

    expect(form.checkValidity()).toBe(true);
  });

  it("shows the placeholder when the value matches no option, like a link to a deactivated professional", () => {
    render(
      <Select
        aria-label="Profesional"
        placeholder="Elige un profesional"
        value="gone"
        options={SERVICES}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent(
      "Elige un profesional",
    );
  });
});
