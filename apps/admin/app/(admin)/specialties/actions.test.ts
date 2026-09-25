import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const result = { error: null as null | { code: string; message: string } };
const updateEq = vi.fn(async () => result);
const deleteEq = vi.fn(async () => result);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: () => ({ eq: updateEq }),
      delete: () => ({ eq: deleteEq }),
    }),
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { deleteSpecialty, renameSpecialty } = await import("./actions");

function nameForm(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("specialty actions", () => {
  beforeEach(() => {
    ownerResult = owner;
    result.error = null;
    updateEq.mockClear();
    deleteEq.mockClear();
  });

  it("reports a failed delete instead of pretending it worked", async () => {
    result.error = { code: "23503", message: "fk" };
    expect(await deleteSpecialty("id")).toEqual({
      error: "No se puede eliminar: hay servicios que usan esta especialidad.",
    });
  });

  it("reports a rename that clashes with an existing specialty", async () => {
    result.error = { code: "23505", message: "dup" };
    expect(await renameSpecialty("id", nameForm("Logopedia"))).toEqual({
      error: "Ya existe una especialidad con ese nombre.",
    });
  });

  it("rejects an empty name without touching the database", async () => {
    expect(await renameSpecialty("id", nameForm("  "))).toEqual({
      error: "El nombre es obligatorio.",
    });
  });

  it("confirms a successful rename", async () => {
    expect(await renameSpecialty("id", nameForm("Psicología"))).toEqual({
      ok: true,
    });
  });

  it("refuses to rename for a non-owner and never attempts the update", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await renameSpecialty("id", nameForm("Psicología"))).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });
});
