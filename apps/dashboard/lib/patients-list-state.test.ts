import { describe, expect, it } from "vitest";
import { patientsListState } from "./patients-list-state";

describe("patientsListState", () => {
  it("shows the error state when the query failed, regardless of row count", () => {
    expect(patientsListState(true, 0)).toBe("error");
    expect(patientsListState(true, 5)).toBe("error");
  });

  it("shows the empty state when the query succeeded with no rows", () => {
    expect(patientsListState(false, 0)).toBe("empty");
  });

  it("shows the list state when the query succeeded with rows", () => {
    expect(patientsListState(false, 3)).toBe("list");
  });
});
