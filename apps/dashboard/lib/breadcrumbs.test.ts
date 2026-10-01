import { describe, expect, it } from "vitest";
import { newPersonBreadcrumbs } from "./breadcrumbs";

describe("newPersonBreadcrumbs", () => {
  it("from Pacientes leads back to the list", () => {
    expect(newPersonBreadcrumbs({})).toEqual([
      { label: "Pacientes", href: "/patients" },
      { label: "Nuevo paciente" },
    ]);
  });

  it("adding a guardian leads back to the minor's record, where it was started", () => {
    expect(
      newPersonBreadcrumbs({ minor: { id: "m1", name: "Lucía Pérez" } }),
    ).toEqual([
      { label: "Pacientes", href: "/patients" },
      { label: "Lucía Pérez", href: "/patients/m1" },
      { label: "Nuevo tutor/a" },
    ]);
  });

  it("from Nueva cita leads back to the half-filled appointment and its agenda day", () => {
    expect(
      newPersonBreadcrumbs({
        returnTo: "/appointments/new?date=2026-10-05&time=10:00",
      }),
    ).toEqual([
      { label: "Agenda", href: "/?date=2026-10-05" },
      {
        label: "Nueva cita",
        href: "/appointments/new?date=2026-10-05&time=10:00",
      },
      { label: "Nuevo paciente" },
    ]);
  });

  it("ignores a return address outside Nueva cita so the trail never points elsewhere", () => {
    expect(
      newPersonBreadcrumbs({
        returnTo: "https://example.com/appointments/new",
      }),
    ).toEqual([
      { label: "Pacientes", href: "/patients" },
      { label: "Nuevo paciente" },
    ]);
  });

  it("from a consent leads back to that consent", () => {
    expect(
      newPersonBreadcrumbs({ consent: { id: "c1", name: "Ana Gil" } }),
    ).toEqual([
      { label: "Consentimientos", href: "/consentimientos" },
      { label: "Ana Gil", href: "/consentimientos/c1" },
      { label: "Crear ficha" },
    ]);
  });
});
