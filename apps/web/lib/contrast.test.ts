import { describe, expect, it } from "vitest";
import { AA_LARGE_TEXT, AA_NORMAL_TEXT, contrastRatio } from "./contrast";

const cream50 = "#f1ede8";
const white = "#ffffff";
const sage500 = "#a1a791";
const sage600 = "#8d927e";
const sage800 = "#5c6151";
const sage900 = "#3f4535";
const ink600 = "#797979";
const ink800 = "#5f5f5f";
const red700 = "#b91c1c";

describe("contrastRatio", () => {
  it("gives the maximum ratio for black on white, so the formula itself is trustworthy", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("gives a ratio of 1 for identical colours", () => {
    expect(contrastRatio(cream50, cream50)).toBeCloseTo(1, 2);
  });
});

describe("colours relied on across the public site", () => {
  it("fails AA for the old primary-button fill, which is why it had to change", () => {
    expect(contrastRatio(sage600, cream50)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("fails AA for the old muted-text tone, which is why it had to change", () => {
    expect(contrastRatio(ink600, cream50)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("fails even the large-text minimum for light text on a sage-500 panel", () => {
    expect(contrastRatio(sage500, cream50)).toBeLessThan(AA_LARGE_TEXT);
  });

  it("passes AA for cream text on the sage-800 buttons, panels and footer used everywhere now", () => {
    expect(contrastRatio(sage800, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("passes AA for cream text on the sage-900 hover fill", () => {
    expect(contrastRatio(sage900, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("passes AA for the ink-800 muted text used for body copy, hints and labels", () => {
    expect(contrastRatio(ink800, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
    expect(contrastRatio(ink800, white)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("passes AA for the red-700 error text used in every form", () => {
    expect(contrastRatio(red700, cream50)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});
