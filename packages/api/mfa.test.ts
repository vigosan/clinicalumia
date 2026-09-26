import { describe, expect, it } from "vitest";
import { getMfaStep } from "./mfa";

function fakeClient(currentLevel: string, nextLevel: string) {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel, nextLevel },
          error: null,
        }),
      },
    },
  } as unknown as Parameters<typeof getMfaStep>[0];
}

describe("getMfaStep", () => {
  it("marks a session that already passed the second factor as done", async () => {
    const step = await getMfaStep(fakeClient("aal2", "aal2"));
    expect(step).toBe("done");
  });

  it("sends a session with a verified factor to the challenge", async () => {
    const step = await getMfaStep(fakeClient("aal1", "aal2"));
    expect(step).toBe("challenge");
  });

  it("sends a session without any factor to enroll", async () => {
    const step = await getMfaStep(fakeClient("aal1", "aal1"));
    expect(step).toBe("enroll");
  });
});
