import { beforeEach, describe, expect, it, vi } from "vitest";

const insertResult: {
  data: { id: string } | null;
  error: { code: string; message?: string } | null;
} = { data: null, error: null };
const updateResult: {
  data: { id: string }[] | null;
  error: { code: string } | null;
} = { data: null, error: null };
const rpcResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};

const insertSelectSingle = vi.fn(async () => insertResult);
const insert = vi.fn(() => ({
  select: () => ({ single: insertSelectSingle }),
}));
const updateEqSelect = vi.fn(async () => updateResult);
const updateEq = vi.fn(() => ({ select: updateEqSelect }));
const update = vi.fn(() => ({ eq: updateEq }));
const rpc = vi.fn(async () => rpcResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({ insert, update }),
    rpc,
  }),
}));

const { savePerson, checkDuplicates } = await import("./actions");

function personForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    first_name: "Ana",
    last_name: "García",
    birth_date: "2000-01-01",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    admin_notes: "",
    is_patient: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

describe("savePerson", () => {
  beforeEach(() => {
    insertResult.data = { id: "person-1" };
    insertResult.error = null;
    updateResult.data = [{ id: "person-1" }];
    updateResult.error = null;
    insert.mockClear();
    insertSelectSingle.mockClear();
    update.mockClear();
    updateEq.mockClear();
    updateEqSelect.mockClear();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(await savePerson(undefined, personForm({ first_name: "" }))).toEqual(
      { error: "El nombre es obligatorio." },
    );
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("reports the DNI message when the 23505 error names the people_tax_id_key constraint", async () => {
    insertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "people_tax_id_key"',
    };
    expect(
      await savePerson(undefined, personForm({ tax_id: "12345678Z" })),
    ).toEqual({ error: "Ya existe una persona con ese DNI/NIE." });
  });

  it("reports the generic message for a 23505 error that names a different constraint", async () => {
    insertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "some_other_key"',
    };
    expect(
      await savePerson(undefined, personForm({ tax_id: "12345678Z" })),
    ).toEqual({ error: "No se ha podido guardar." });
  });

  it("reports the permission message when an edit does not affect any row", async () => {
    updateResult.data = [];
    expect(await savePerson(undefined, personForm({ id: "person-1" }))).toEqual(
      { error: "No tienes permiso para hacer esto." },
    );
  });
});

describe("checkDuplicates", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpcResult.data = [];
    rpcResult.error = null;
  });

  it("passes the parameters straight through to the RPC", async () => {
    await checkDuplicates({
      tax_id: "12345678Z",
      email: "ana@example.com",
      phone: "600111222",
      exclude: "person-1",
    });
    expect(rpc).toHaveBeenCalledWith("find_possible_duplicates", {
      p_tax_id: "12345678Z",
      p_email: "ana@example.com",
      p_phone: "600111222",
      p_exclude: "person-1",
    });
  });

  it("returns an empty list when the RPC fails, since the warning is a help and not a barrier", async () => {
    rpcResult.error = { message: "boom" };
    expect(await checkDuplicates({ tax_id: "", email: "", phone: "" })).toEqual(
      [],
    );
  });
});
