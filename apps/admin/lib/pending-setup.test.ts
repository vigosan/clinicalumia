import { describe, expect, it } from "vitest";
import { pendingSetup } from "./pending-setup";

const settings = {
  legal_name: "Patricia Hernán Sánchez",
  tax_id: "20449989E",
  address_line: "Calle Montesa 7",
  postal_code: "46800",
  city: "Xàtiva",
};

const confirmed = [
  { code: "main" as const, year: 2026, configured: true },
  { code: "rectifying" as const, year: 2026, configured: true },
];

const ready = {
  settings,
  series: confirmed,
  year: 2026,
  activeServiceCount: 4,
  professionalsWithoutSchedule: [],
};

describe("pendingSetup", () => {
  it("lists nothing when the clinic can take bookings, charge and invoice, so the home can say everything is ready", () => {
    expect(pendingSetup(ready)).toEqual([]);
  });

  it("sends the owner to the clinic details for each numbering or fiscal gap, since that is the page where she fixes them", () => {
    expect(
      pendingSetup({
        ...ready,
        settings: { ...settings, tax_id: "", city: "" },
        series: [
          { code: "main", year: 2026, configured: false },
          { code: "rectifying", year: 2026, configured: false },
        ],
      }).map(({ id, href }) => ({ id, href })),
    ).toEqual([
      { id: "clinic-fiscal-warning", href: "/clinic" },
      { id: "clinic-address-warning", href: "/clinic" },
      { id: "invoice-series-warning", href: "/clinic" },
      { id: "invoice-series-rectifying-warning", href: "/clinic" },
    ]);
  });

  it("warns that without an active service nobody can be booked, and links to the services", () => {
    expect(pendingSetup({ ...ready, activeServiceCount: 0 })).toEqual([
      {
        id: "services-warning",
        text: "No hay ningún servicio activo: no se pueden dar citas ni reservar desde la web.",
        href: "/services",
      },
    ]);
  });

  it("names each active professional without a weekly schedule and links to that person's schedule, because nobody can book a slot with her", () => {
    expect(
      pendingSetup({
        ...ready,
        professionalsWithoutSchedule: [
          { id: "p1", full_name: "Marc Ejemplo" },
          { id: "p2", full_name: "Laura Ejemplo" },
        ],
      }),
    ).toEqual([
      {
        id: "schedule-warning-p1",
        text: "Marc Ejemplo no tiene horario semanal: no tendrá huecos en la agenda ni en la web.",
        href: "/schedules?employee=p1",
      },
      {
        id: "schedule-warning-p2",
        text: "Laura Ejemplo no tiene horario semanal: no tendrá huecos en la agenda ni en la web.",
        href: "/schedules?employee=p2",
      },
    ]);
  });
});
