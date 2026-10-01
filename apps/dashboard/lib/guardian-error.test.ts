import { describe, expect, it } from "vitest";
import { guardianErrorCode, guardianErrorMessage } from "./guardian-error";

describe("guardianErrorCode", () => {
  it("maps the minor-guardian message to its code", () => {
    expect(guardianErrorCode("El tutor/a tiene que ser mayor de edad.")).toBe(
      "minor-guardian",
    );
  });

  it("maps the already-has-a-primary message to its code", () => {
    expect(guardianErrorCode("Ya tiene tutor/a principal.")).toBe("primary");
  });

  it("maps the already-a-guardian message to its code", () => {
    expect(guardianErrorCode("Ya es tutor/a de este menor.")).toBe("already");
  });

  it("maps any other message to unknown, so free text never reaches the url", () => {
    expect(guardianErrorCode("boom")).toBe("unknown");
  });
});

describe("guardianErrorMessage", () => {
  it("maps a known code back to its fixed spanish message", () => {
    expect(guardianErrorMessage("primary")).toBe("Ya tiene tutor/a principal.");
  });

  it("ignores a code that is not in the fixed list, since it could be arbitrary user input", () => {
    expect(guardianErrorMessage("<script>alert(1)</script>")).toBeUndefined();
  });

  it("returns undefined when there is no code", () => {
    expect(guardianErrorMessage(undefined)).toBeUndefined();
  });
});
