import { describe, expect, it } from "vitest";
import { firstAffected } from "./affected-appointments";

describe("firstAffected", () => {
  it("shows every appointment when there are four or fewer, with nothing hidden", () => {
    expect(firstAffected([1, 2, 3, 4])).toEqual({
      shown: [1, 2, 3, 4],
      more: 0,
    });
  });

  it("keeps the alert short: shows the first four and counts the rest for «y N más»", () => {
    expect(firstAffected([1, 2, 3, 4, 5, 6, 7])).toEqual({
      shown: [1, 2, 3, 4],
      more: 3,
    });
  });
});
