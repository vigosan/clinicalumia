import { describe, expect, it, vi } from "vitest";
import { createDuplicateChecker } from "./duplicate-checker";

function fields(
  overrides: Partial<{ tax_id: string; email: string; phone: string }> = {},
) {
  return { tax_id: "", email: "", phone: "", ...overrides };
}

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
