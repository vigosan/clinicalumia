import { describe, expect, it } from "vitest";
import { createSubmitGate } from "./submit-gate";

describe("createSubmitGate", () => {
  it("lets the first tryStart through", () => {
    const gate = createSubmitGate();
    expect(gate.tryStart()).toBe(true);
  });

  it("rejects a second tryStart while the first hasn't finished, the way a double-click races an awaited check", () => {
    const gate = createSubmitGate();
    expect(gate.tryStart()).toBe(true);
    expect(gate.tryStart()).toBe(false);
    expect(gate.isSubmitting()).toBe(true);
  });

  it("lets a new tryStart through again once finish is called", () => {
    const gate = createSubmitGate();
    gate.tryStart();
    gate.finish();
    expect(gate.isSubmitting()).toBe(false);
    expect(gate.tryStart()).toBe(true);
  });
});
