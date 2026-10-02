import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio } from "./contrast";

const cream50 = "#f1ede8";
const white = "#ffffff";
const sage500 = "#a1a791";
const sage600 = "#8d927e";
const sage800 = "#5c6151";
const sage900 = "#3f4535";
const ink600 = "#797979";
const ink800 = "#5f5f5f";
const ink900 = "#3a3a3a";

describe("contrastRatio", () => {
  it("gives the maximum ratio for black on white, so the formula itself is trustworthy", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("gives a ratio of 1 for identical colours", () => {
    expect(contrastRatio(cream50, cream50)).toBeCloseTo(1, 2);
  });
});

describe("colours relied on for the web buttons, form hints and footer", () => {
  it("fails AA for the old primary-button fill, which is why «Firmar y enviar» and the other primary buttons darkened it", () => {
    expect(contrastRatio(sage600, cream50)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("passes AA for cream text on the sage-800 buttons and their sage-900 hover fill", () => {
    expect(contrastRatio(sage800, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
    expect(contrastRatio(sage900, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("fails AA for the old muted hint-text tone, which is why the form hints in consentimiento, reservar and acceder darkened it", () => {
    expect(contrastRatio(ink600, cream50)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("passes AA for the ink-800 hint text on cream and on white form panels", () => {
    expect(contrastRatio(ink800, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
    expect(contrastRatio(ink800, white)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("fails AA for cream links on the sage-500 footer, which is why the footer text (not its background) changed", () => {
    expect(contrastRatio(cream50, sage500)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("passes AA for ink-900 links on the unchanged sage-500 footer background", () => {
    expect(contrastRatio(ink900, sage500)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});
