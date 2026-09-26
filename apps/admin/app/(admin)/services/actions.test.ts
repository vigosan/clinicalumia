import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const result = { error: null as null | { code: string; message: string } };
const insert = vi.fn(async () => result);
const updateEq = vi.fn(async () => result);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      insert,
      update: () => ({ eq: updateEq }),
    }),
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { saveService, setServiceActive } = await import("./actions");

function serviceForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("specialty_id", "specialty-1");
  data.set("name", "Sesión");
  data.set("duration_minutes", "45");
  data.set("price", "50");
  data.set("vat", "exempt");
  data.set("booking_payment", "none");
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

describe("service actions", () => {
  beforeEach(() => {
    ownerResult = owner;
    result.error = null;
    insert.mockClear();
    updateEq.mockClear();
  });

  it("refuses saveService for a non-owner and never inserts anything", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await saveService(undefined, serviceForm())).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(await saveService(undefined, serviceForm({ name: "" }))).toEqual({
      error: "El nombre es obligatorio.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports a service name that clashes within the same specialty", async () => {
    result.error = { code: "23505", message: "dup" };
    expect(await saveService(undefined, serviceForm())).toEqual({
      error: "Ya existe un servicio con ese nombre en esa especialidad.",
    });
  });

  it("reports a database error when changing a service's active state", async () => {
    result.error = { code: "500", message: "boom" };
    expect(await setServiceActive("service-1", false)).toEqual({
      error: "No se ha podido cambiar el estado del servicio.",
    });
  });
});
