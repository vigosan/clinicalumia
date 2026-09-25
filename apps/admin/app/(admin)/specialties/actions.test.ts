import { beforeEach, describe, expect, it, vi } from "vitest";

const result = { error: null as null | { code: string; message: string } };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: () => ({ eq: async () => result }),
      delete: () => ({ eq: async () => result }),
    }),
  }),
}));

const { deleteSpecialty, renameSpecialty } = await import("./actions");

function nameForm(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("specialty actions", () => {
  beforeEach(() => {
    result.error = null;
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
});
