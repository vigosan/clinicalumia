import { describe, expect, it } from "vitest";
import {
  localVersions,
  migrationStatus,
  promotionBlockers,
} from "./migrations";

describe("localVersions", () => {
  it("reads the timestamp of each migration file in order, ignoring anything else", () => {
    expect(
      localVersions([
        "20260925090000_roles.sql",
        "README.md",
        "20260501062643_init_schema.sql",
      ]),
    ).toEqual(["20260501062643", "20260925090000"]);
  });
});

describe("migrationStatus", () => {
  it("shows per migration whether each database has it, so drift is visible at a glance", () => {
    expect(migrationStatus(["1", "2"], ["1", "2"], ["1"])).toEqual([
      { version: "1", dev: true, prod: true },
      { version: "2", dev: true, prod: false },
    ]);
  });

  it("treats a database that never ran migrations as having none", () => {
    expect(migrationStatus(["1"], [], [])).toEqual([
      { version: "1", dev: false, prod: false },
    ]);
  });
});

describe("promotionBlockers", () => {
  it("allows promoting when everything pending in prod is already applied in dev", () => {
    expect(promotionBlockers(["1", "2"], ["1", "2"], ["1"])).toEqual([]);
  });

  it("blocks a migration that dev has not run yet, so prod never gets untested changes", () => {
    expect(promotionBlockers(["1", "2"], ["1"], ["1"])).toEqual(["2"]);
  });

  it("blocks when prod has a migration missing from the repo, because the schemas have drifted", () => {
    expect(promotionBlockers(["1"], ["1"], ["1", "9"])).toEqual(["9"]);
  });
});
