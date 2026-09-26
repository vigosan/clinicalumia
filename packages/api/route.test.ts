import { describe, expect, it } from "vitest";
import { nextRoute, safeNext } from "./route";

describe("nextRoute", () => {
  describe("without a session", () => {
    it("sends a protected path to login", () => {
      expect(
        nextRoute({
          path: "/services",
          search: "",
          signedIn: false,
          step: null,
        }),
      ).toEqual({ redirect: "/login" });
    });

    it.each([
      "/login",
      "/login/recuperar",
      "/auth/confirm",
    ])("leaves %s reachable", (path) => {
      expect(
        nextRoute({ path, search: "", signedIn: false, step: null }),
      ).toBeNull();
    });

    it.each([
      "/auth/dos-pasos",
      "/auth/contrasena",
    ])("does not treat %s as public before there is a session", (path) => {
      expect(
        nextRoute({ path, search: "", signedIn: false, step: null }),
      ).toEqual({ redirect: "/login" });
    });
  });

  describe("step enroll", () => {
    it("sends the rest of the app to activate two-factor", () => {
      expect(
        nextRoute({ path: "/", search: "", signedIn: true, step: "enroll" }),
      ).toEqual({ redirect: "/auth/dos-pasos/activar" });
    });

    it.each([
      "/auth/contrasena",
      "/auth/dos-pasos/activar",
    ])("leaves %s reachable, since an invited employee sets the password before activating", (path) => {
      expect(
        nextRoute({ path, search: "", signedIn: true, step: "enroll" }),
      ).toBeNull();
    });

    it("does not let a path that merely starts with /auth/confirm impersonate it", () => {
      expect(
        nextRoute({
          path: "/auth/confirmx",
          search: "",
          signedIn: true,
          step: "enroll",
        }),
      ).toEqual({ redirect: "/auth/dos-pasos/activar" });
    });
  });

  describe("step challenge", () => {
    it("sends a protected path to the challenge with next set to come back to it", () => {
      expect(
        nextRoute({
          path: "/clinic",
          search: "",
          signedIn: true,
          step: "challenge",
        }),
      ).toEqual({ redirect: "/auth/dos-pasos?next=%2Fclinic" });
    });

    it("carries even an auth path through next, since only the challenge itself is exempt", () => {
      expect(
        nextRoute({
          path: "/auth/contrasena",
          search: "",
          signedIn: true,
          step: "challenge",
        }),
      ).toEqual({ redirect: "/auth/dos-pasos?next=%2Fauth%2Fcontrasena" });
    });

    it("leaves the challenge page itself reachable", () => {
      expect(
        nextRoute({
          path: "/auth/dos-pasos",
          search: "",
          signedIn: true,
          step: "challenge",
        }),
      ).toBeNull();
    });

    it("does not let a path that merely starts with /auth/confirm impersonate it", () => {
      expect(
        nextRoute({
          path: "/auth/confirmx",
          search: "",
          signedIn: true,
          step: "challenge",
        }),
      ).toEqual({ redirect: "/auth/dos-pasos?next=%2Fauth%2Fconfirmx" });
    });
  });

  describe("step done", () => {
    it.each([
      "/login",
      "/auth/dos-pasos",
      "/auth/dos-pasos/activar",
    ])("sends %s back home, since verification is already finished", (path) => {
      expect(
        nextRoute({ path, search: "", signedIn: true, step: "done" }),
      ).toEqual({ redirect: "/" });
    });

    it("leaves the rest of the app reachable", () => {
      expect(
        nextRoute({
          path: "/services",
          search: "",
          signedIn: true,
          step: "done",
        }),
      ).toBeNull();
    });

    it("does not let a path that merely starts with /auth/dos-pasos impersonate it", () => {
      expect(
        nextRoute({
          path: "/auth/dos-pasos-fake",
          search: "",
          signedIn: true,
          step: "done",
        }),
      ).toBeNull();
    });
  });
});

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/clinic")).toBe("/clinic");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "",
    null,
  ])("falls back to / for %s, since it could send the user off-site", (value) => {
    expect(safeNext(value)).toBe("/");
  });

  it.each([
    "/clinic",
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "",
    null,
  ])("never resolves to a different origin than panel.clinicalumia.es for %s", (value) => {
    const resolved = new URL(safeNext(value), "https://panel.clinicalumia.es");
    expect(resolved.origin).toBe("https://panel.clinicalumia.es");
  });
});
