import { describe, expect, it } from "vitest";
import {
  initialSignatureChoice,
  type SignatureChoice,
  signatureChoice,
} from "./typed-signature";

function apply(...events: Parameters<typeof signatureChoice>[1][]) {
  return events.reduce<SignatureChoice>(
    signatureChoice,
    initialSignatureChoice,
  );
}

const ana = { firstName: "Ana", lastName: "García López", guardian: "" };

describe("signatureChoice", () => {
  it("starts drawing, so the form behaves as it always did until the patient chooses otherwise", () => {
    expect(initialSignatureChoice.method).toBe("drawn");
  });

  it("switches between drawing and typing", () => {
    const typed = apply({ type: "method", method: "typed" });
    expect(typed.method).toBe("typed");
    expect(
      signatureChoice(typed, { type: "method", method: "drawn" }).method,
    ).toBe("drawn");
  });

  it("prefills the typed name with the patient's name, so signing by typing is one tap", () => {
    const state = apply({ type: "signer", ...ana });
    expect(state.typedName).toBe("Ana García López");
  });

  it("prefills the guardian's name for a minor, because the guardian is who signs", () => {
    const state = apply({ type: "signer", ...ana, guardian: "Luis García" });
    expect(state.typedName).toBe("Luis García");
  });

  it("follows the name while the patient keeps filling in the form", () => {
    const state = apply(
      { type: "signer", ...ana, lastName: "" },
      { type: "signer", ...ana },
    );
    expect(state.typedName).toBe("Ana García López");
  });

  it("keeps what the patient typed once they edit it, instead of overwriting their signature", () => {
    const state = apply(
      { type: "signer", ...ana },
      { type: "typedName", value: "A. García" },
      { type: "signer", ...ana, lastName: "García" },
    );
    expect(state.typedName).toBe("A. García");
  });

  it("keeps an emptied name empty, so the form asks for the signature instead of inventing one", () => {
    const state = apply(
      { type: "signer", ...ana },
      { type: "typedName", value: "" },
      { type: "signer", ...ana, firstName: "Anna" },
    );
    expect(state.typedName).toBe("");
  });
});
