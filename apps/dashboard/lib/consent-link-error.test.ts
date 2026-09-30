import { describe, expect, it } from "vitest";
import {
  consentLinkErrorCode,
  consentLinkErrorMessage,
} from "./consent-link-error";

describe("consentLinkErrorCode", () => {
  it("maps each known link message to its code", () => {
    expect(consentLinkErrorCode("No tienes permiso para hacer esto.")).toBe(
      "permission",
    );
    expect(
      consentLinkErrorCode("Esa ficha ya no existe o está archivada."),
    ).toBe("person-not-found");
    expect(consentLinkErrorCode("Ese consentimiento ya no existe.")).toBe(
      "consent-not-found",
    );
    expect(consentLinkErrorCode("Este consentimiento ya está asociado.")).toBe(
      "already-linked",
    );
  });

  it("maps any other message to unknown, so free text never reaches the url", () => {
    expect(consentLinkErrorCode("boom")).toBe("unknown");
  });
});

describe("consentLinkErrorMessage", () => {
  it("maps a known code back to its fixed spanish message", () => {
    expect(consentLinkErrorMessage("already-linked")).toBe(
      "Este consentimiento ya está asociado.",
    );
  });

  it("ignores a code that is not in the fixed list, since it could be arbitrary user input", () => {
    expect(consentLinkErrorMessage("<b>hola</b>")).toBeUndefined();
  });

  it("returns undefined when there is no code", () => {
    expect(consentLinkErrorMessage(undefined)).toBeUndefined();
  });
});
