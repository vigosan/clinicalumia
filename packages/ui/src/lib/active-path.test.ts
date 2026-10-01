import { describe, expect, it } from "vitest";
import { isActiveNavItem, isActivePath } from "./active-path";

describe("isActivePath", () => {
  it("marks a section active on its own page and on its sub-pages", () => {
    expect(isActivePath("/team", "/team")).toBe(true);
    expect(isActivePath("/team", "/team/123")).toBe(true);
  });

  it("does not mark Inicio active everywhere, only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/", "/team")).toBe(false);
  });

  it("does not confuse sections that share a prefix", () => {
    expect(isActivePath("/team", "/teams")).toBe(false);
  });
});

describe("isActiveNavItem", () => {
  it("keeps Agenda marked while creating an appointment, because Nueva cita belongs to the agenda", () => {
    const agenda = { href: "/", label: "Agenda", match: ["/appointments"] };
    expect(isActiveNavItem(agenda, "/")).toBe(true);
    expect(isActiveNavItem(agenda, "/appointments/new")).toBe(true);
    expect(isActiveNavItem(agenda, "/patients")).toBe(false);
  });

  it("without extra prefixes behaves like the item's own path", () => {
    const patients = { href: "/patients", label: "Pacientes" };
    expect(isActiveNavItem(patients, "/patients/123/edit")).toBe(true);
    expect(isActiveNavItem(patients, "/appointments/new")).toBe(false);
  });
});
