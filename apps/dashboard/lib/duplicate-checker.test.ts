import { describe, expect, it, vi } from "vitest";
import {
  createDuplicateChecker,
  type DuplicateFields,
  hasDuplicateInput,
} from "./duplicate-checker";

function fields(overrides: Partial<DuplicateFields> = {}): DuplicateFields {
  return {
    tax_id: "",
    email: "",
    phone: "",
    first_name: "",
    last_name: "",
    birth_date: "",
    ...overrides,
  };
}

describe("hasDuplicateInput", () => {
  it("is false for a form with only a name, since a name alone is too common to search for", () => {
    expect(
      hasDuplicateInput(fields({ first_name: "Elena", last_name: "Gómez" })),
    ).toBe(false);
  });

  it("is true once the name comes with a birth date, so minors without dni, email or phone are checked too", () => {
    expect(
      hasDuplicateInput(
        fields({
          first_name: "Elena",
          last_name: "Gómez",
          birth_date: "1990-03-22",
        }),
      ),
    ).toBe(true);
  });

  it("is true with any contact field on its own", () => {
    expect(hasDuplicateInput(fields({ phone: "600111222" }))).toBe(true);
    expect(hasDuplicateInput(fields({ email: "a@b.com" }))).toBe(true);
    expect(hasDuplicateInput(fields({ tax_id: "12345678Z" }))).toBe(true);
  });

  it("is false for an empty form", () => {
    expect(hasDuplicateInput(fields())).toBe(false);
  });
});

describe("createDuplicateChecker", () => {
  it("shares one in-flight request when submit races the blur check for the same fields, instead of saving before it resolves", async () => {
    let resolveCheck: (value: string[]) => void = () => {};
    const check = vi.fn(
      () => new Promise<string[]>((resolve) => (resolveCheck = resolve)),
    );
    const checker = createDuplicateChecker(check);

    const fromBlur = checker.ensureResolved(fields({ phone: "600111222" }));
    const fromSubmit = checker.ensureResolved(fields({ phone: "600111222" }));

    resolveCheck(["Lucía Martínez Soler"]);
    expect(await fromBlur).toEqual(["Lucía Martínez Soler"]);
    expect(await fromSubmit).toEqual(["Lucía Martínez Soler"]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("does not call the check again for fields already resolved", async () => {
    const check = vi.fn(async () => []);
    const checker = createDuplicateChecker(check);

    await checker.ensureResolved(fields({ email: "a@b.com" }));
    await checker.ensureResolved(fields({ email: "a@b.com" }));

    expect(check).toHaveBeenCalledTimes(1);
  });

  it("calls the check again once a field changes", async () => {
    const check = vi.fn(async () => []);
    const checker = createDuplicateChecker(check);

    await checker.ensureResolved(fields({ tax_id: "12345678Z" }));
    await checker.ensureResolved(fields({ tax_id: "11223344B" }));

    expect(check).toHaveBeenCalledTimes(2);
  });

  it("propagates a rejection to the caller instead of swallowing it", async () => {
    const check = vi.fn(async () => {
      throw new Error("transport failure");
    });
    const checker = createDuplicateChecker(check);

    await expect(
      checker.ensureResolved(fields({ phone: "600111222" })),
    ).rejects.toThrow("transport failure");
  });

  it("clears the in-flight request on rejection so a later call for the same fields retries instead of getting stuck", async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport failure"))
      .mockResolvedValueOnce(["Jorge Ruiz Pérez"]);
    const checker = createDuplicateChecker(check);

    await expect(
      checker.ensureResolved(fields({ tax_id: "11223344B" })),
    ).rejects.toThrow("transport failure");

    expect(
      await checker.ensureResolved(fields({ tax_id: "11223344B" })),
    ).toEqual(["Jorge Ruiz Pérez"]);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("treats fields marked resolved (after the user chose to continue) as already checked", async () => {
    const check = vi.fn(async () => ["Jorge Ruiz Pérez"]);
    const checker = createDuplicateChecker(check);

    const found = await checker.ensureResolved(fields({ tax_id: "11223344B" }));
    expect(found).toEqual(["Jorge Ruiz Pérez"]);

    checker.markResolved(fields({ tax_id: "11223344B" }), []);
    expect(
      await checker.ensureResolved(fields({ tax_id: "11223344B" })),
    ).toEqual([]);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
