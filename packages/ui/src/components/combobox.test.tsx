import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PersonCombobox, type PersonComboboxItem } from "./combobox";

const NORA: PersonComboboxItem = {
  id: "nora-id",
  first_name: "Nora",
  last_name: "Martínez",
  age: 8,
  phone: "+34600111222",
};
const NURIA: PersonComboboxItem = {
  id: "nuria-id",
  first_name: "Nuria",
  last_name: "Soler",
  age: 41,
  phone: null,
};

function submittedValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function AppointmentLikeForm({
  search,
  onSubmit,
}: {
  search: (query: string) => Promise<PersonComboboxItem[]>;
  onSubmit: () => void;
}) {
  const [selected, setSelected] = useState<PersonComboboxItem | null>(null);
  return (
    <form
      data-testid="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input type="hidden" name="patient_id" value={selected?.id ?? ""} />
      <PersonCombobox
        label="Paciente"
        search={search}
        onSelect={setSelected}
        emptyText="No hay pacientes con esos datos."
        data-testid="patient-search"
        optionTestId="patient-option"
      />
      <output data-testid="selected">{selected?.first_name ?? ""}</output>
    </form>
  );
}

describe("PersonCombobox", () => {
  it("shows name, age and phone of each match, so staff can tell two people with the same name apart", async () => {
    render(
      <PersonCombobox
        label="Paciente"
        search={async () => [NORA, NURIA]}
        onSelect={() => {}}
        emptyText="No hay pacientes con esos datos."
        optionTestId="patient-option"
      />,
    );
    await userEvent.type(
      screen.getByRole("combobox", { name: "Paciente" }),
      "nu",
    );

    const options = await screen.findAllByTestId("patient-option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Nora Martínez");
    expect(options[0]).toHaveTextContent("8 años");
    expect(options[0]).toHaveTextContent("+34600111222");
    expect(options[1]).toHaveTextContent("Nuria Soler");
    expect(options[1]).toHaveTextContent("41 años");
  });

  it("is used with the keyboard alone: arrows move, Enter picks without submitting the surrounding form, and the id goes out under its name", async () => {
    const onSubmit = vi.fn();
    render(
      <AppointmentLikeForm
        search={async () => [NORA, NURIA]}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Paciente" });
    await userEvent.type(input, "nu");
    await screen.findAllByRole("option");
    expect(input).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByTestId("selected")).toHaveTextContent("Nuria");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      submittedValues(screen.getByTestId("form") as HTMLFormElement),
    ).toEqual({ patient_id: "nuria-id" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("closes with Escape and keeps the focus in the search box, so nobody loses their place", async () => {
    const onSelect = vi.fn();
    render(
      <PersonCombobox
        label="Paciente"
        search={async () => [NORA]}
        onSelect={onSelect}
        emptyText="No hay pacientes con esos datos."
      />,
    );
    const input = screen.getByRole("combobox", { name: "Paciente" });
    await userEvent.type(input, "nora");
    await screen.findByRole("option", { name: /Nora Martínez/ });

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue("nora");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("tells staff it is searching and then that nobody matches, instead of an empty box", async () => {
    let finish: ((people: PersonComboboxItem[]) => void) | undefined;
    render(
      <PersonCombobox
        label="Paciente"
        search={() =>
          new Promise<PersonComboboxItem[]>((resolve) => {
            finish = resolve;
          })
        }
        onSelect={() => {}}
        emptyText="No hay pacientes con esos datos."
        data-testid="patient-search"
      />,
    );
    await userEvent.type(screen.getByTestId("patient-search"), "zzz");

    expect(await screen.findByText("Buscando…")).toBeInTheDocument();
    await waitFor(() => expect(finish).toBeDefined());
    finish?.([]);

    expect(await screen.findByTestId("patient-search-empty")).toHaveTextContent(
      "No hay pacientes con esos datos.",
    );
    expect(screen.queryByText("Buscando…")).not.toBeInTheDocument();
  });

  it("says the search failed when the server cannot answer, so staff know to try again", async () => {
    render(
      <PersonCombobox
        label="Paciente"
        search={async () => {
          throw new Error("No se ha podido buscar.");
        }}
        onSelect={() => {}}
        emptyText="No hay pacientes con esos datos."
        data-testid="patient-search"
      />,
    );
    await userEvent.type(screen.getByTestId("patient-search"), "nora");

    expect(await screen.findByTestId("patient-search-error")).toHaveTextContent(
      "No se ha podido buscar. Inténtalo de nuevo.",
    );
  });

  it("ignores an answer that arrives after a newer search, so the list always matches what is typed", async () => {
    const pending: Record<string, (people: PersonComboboxItem[]) => void> = {};
    render(
      <PersonCombobox
        label="Paciente"
        search={(query) =>
          new Promise<PersonComboboxItem[]>((resolve) => {
            pending[query] = resolve;
          })
        }
        onSelect={() => {}}
        emptyText="No hay pacientes con esos datos."
      />,
    );
    const input = screen.getByRole("combobox", { name: "Paciente" });
    await userEvent.type(input, "no");
    await waitFor(() => expect(pending.no).toBeDefined());
    await userEvent.type(input, "ra");
    await waitFor(() => expect(pending.nora).toBeDefined());

    await waitFor(() => pending.nora?.([NORA]));
    await waitFor(() => pending.no?.([NURIA]));

    expect(
      await screen.findByRole("option", { name: /Nora Martínez/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Nuria Soler/ }),
    ).not.toBeInTheDocument();
  });

  it("offers «Nuevo paciente» as the last option, reachable with the keyboard, for when the person has no record yet", async () => {
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    render(
      <PersonCombobox
        label="Paciente"
        search={async () => [NORA]}
        onSelect={onSelect}
        emptyText="No hay pacientes con esos datos."
        action={{ label: "Nuevo paciente", onSelect: onCreate }}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Paciente" });
    await userEvent.click(input);
    expect(
      screen.getByRole("option", { name: "Nuevo paciente" }),
    ).toBeInTheDocument();

    await userEvent.type(input, "nora");
    await screen.findByRole("option", { name: /Nora Martínez/ });
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not jump to «Nuevo paciente» when Enter is pressed before the results arrive, so a half-filled appointment is not lost", async () => {
    const onCreate = vi.fn();
    render(
      <PersonCombobox
        label="Paciente"
        search={() => new Promise<PersonComboboxItem[]>(() => {})}
        onSelect={() => {}}
        emptyText="No hay pacientes con esos datos."
        action={{ label: "Nuevo paciente", onSelect: onCreate }}
      />,
    );
    await userEvent.type(
      screen.getByRole("combobox", { name: "Paciente" }),
      "nora{Enter}",
    );

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("picks a person with a click too", async () => {
    const onSelect = vi.fn();
    render(
      <PersonCombobox
        label="Paciente"
        search={async () => [NORA, NURIA]}
        onSelect={onSelect}
        emptyText="No hay pacientes con esos datos."
      />,
    );
    await userEvent.type(
      screen.getByRole("combobox", { name: "Paciente" }),
      "n",
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /Nuria Soler/ }),
    );

    expect(onSelect).toHaveBeenCalledWith(NURIA);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
