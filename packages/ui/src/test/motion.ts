import { expect } from "vitest";

const MOVING = /animate-(slide|pop|toast)/;

export function expectExitThatOnlyFadesWithReducedMotion(element: Element) {
  const classes = (element.getAttribute("class") ?? "").split(/\s+/);
  expect(classes).toContain("data-[state=closed]:animate-fade-out");
  expect(classes).toContain("data-[state=open]:animate-fade-in");
  const moving = classes.filter((name) => MOVING.test(name));
  expect(moving.some((name) => name.includes("data-[state=closed]:"))).toBe(
    true,
  );
  for (const name of moving) expect(name).toContain("motion-safe:");
}
