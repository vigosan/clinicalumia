import { beforeEach, describe, expect, it, vi } from "vitest";

const insertResult: {
  data: { id: string } | null;
  error: { code: string; message?: string } | null;
} = { data: null, error: null };
const updateResult: {
  data: { id: string }[] | null;
  error: { code: string } | null;
} = { data: null, error: null };
const archivedUpdateResult: { error: { code?: string } | null } = {
  error: null,
};
const rpcResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
const guardianLookupResult: {
  data: { birth_date: string | null } | null;
  error: null;
} = { data: { birth_date: null }, error: null };
const guardianshipInsertResult: {
  error: { code?: string; message?: string; details?: string } | null;
} = { error: null };
const deletePersonResult: {
  data: { id: string }[] | null;
  error: { code?: string } | null;
} = { data: [], error: null };

const insertSelectSingle = vi.fn(async () => insertResult);
const peopleInsert = vi.fn(() => ({
  select: () => ({ single: insertSelectSingle }),
}));
const updateEqSelect = vi.fn(async () => updateResult);
const updateEq = vi.fn(() =>
  Object.assign(Promise.resolve(archivedUpdateResult), {
    select: updateEqSelect,
  }),
);
const peopleUpdate = vi.fn(() => ({ eq: updateEq }));
const guardianMaybeSingle = vi.fn(async () => guardianLookupResult);
const guardianEq = vi.fn(() => ({ maybeSingle: guardianMaybeSingle }));
const peopleSelect = vi.fn(() => ({ eq: guardianEq }));
const deleteSelect = vi.fn(async () => deletePersonResult);
const deleteEq = vi.fn(() => ({ select: deleteSelect }));
const peopleDelete = vi.fn(() => ({ eq: deleteEq }));
const guardianshipsInsert = vi.fn(async () => guardianshipInsertResult);
const guardianshipDeleteResult: { error: { code?: string } | null } = {
  error: null,
};
const guardianshipDeleteEq2 = vi.fn(() =>
  Promise.resolve(guardianshipDeleteResult),
);
const guardianshipDeleteEq1 = vi.fn(() => ({ eq: guardianshipDeleteEq2 }));
const guardianshipsDelete = vi.fn(() => ({ eq: guardianshipDeleteEq1 }));
const rpc = vi.fn(async () => rpcResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === "guardianships"
        ? { insert: guardianshipsInsert, delete: guardianshipsDelete }
        : {
            insert: peopleInsert,
            update: peopleUpdate,
            select: peopleSelect,
            delete: peopleDelete,
          },
    rpc,
  }),
}));

const {
  savePerson,
  checkDuplicates,
  addGuardian,
  removeGuardian,
  setArchived,
  deletePerson,
} = await import("./actions");

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
    peopleInsert.mockClear();
    insertSelectSingle.mockClear();
    peopleUpdate.mockClear();
    updateEq.mockClear();
    updateEqSelect.mockClear();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(await savePerson(undefined, personForm({ first_name: "" }))).toEqual(
      { error: "El nombre es obligatorio." },
    );
    expect(peopleInsert).not.toHaveBeenCalled();
    expect(peopleUpdate).not.toHaveBeenCalled();
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

describe("addGuardian", () => {
  beforeEach(() => {
    guardianLookupResult.data = { birth_date: null };
    guardianshipInsertResult.error = null;
    guardianshipsInsert.mockClear();
    guardianMaybeSingle.mockClear();
  });

  it("rejects a person as their own guardian without touching the database", async () => {
    expect(await addGuardian("person-1", "person-1", "madre", false)).toEqual({
      error: "Una persona no puede ser su propio tutor.",
    });
    expect(guardianshipsInsert).not.toHaveBeenCalled();
  });

  it("rejects a guardian who is still a minor", async () => {
    guardianLookupResult.data = { birth_date: "2015-01-01" };
    expect(await addGuardian("minor-1", "guardian-1", "madre", false)).toEqual({
      error: "Un tutor tiene que ser mayor de edad.",
    });
    expect(guardianshipsInsert).not.toHaveBeenCalled();
  });

  it("reports an already-has-a-primary-guardian message for the guardianships_one_primary index", async () => {
    guardianshipInsertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "guardianships_one_primary"',
    };
    expect(await addGuardian("minor-1", "guardian-1", "madre", true)).toEqual({
      error: "Ya tiene un tutor principal.",
    });
  });

  it("reports an already-a-guardian message for the guardianships_pkey constraint", async () => {
    guardianshipInsertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "guardianships_pkey"',
    };
    expect(await addGuardian("minor-1", "guardian-1", "madre", false)).toEqual({
      error: "Ya es tutor de este menor.",
    });
  });
});

describe("removeGuardian", () => {
  it("deletes the guardianship row for the given minor and guardian", async () => {
    expect(await removeGuardian("minor-1", "guardian-1")).toEqual({
      ok: true,
    });
    expect(guardianshipDeleteEq1).toHaveBeenCalledWith("minor_id", "minor-1");
    expect(guardianshipDeleteEq2).toHaveBeenCalledWith(
      "guardian_id",
      "guardian-1",
    );
  });
});

describe("setArchived", () => {
  beforeEach(() => {
    archivedUpdateResult.error = null;
    peopleUpdate.mockClear();
  });

  it("writes archived_at to the current time when archiving", async () => {
    expect(await setArchived("person-1", true)).toEqual({ ok: true });
    expect(peopleUpdate).toHaveBeenCalledWith({
      archived_at: expect.any(String),
    });
  });

  it("writes archived_at to null when restoring", async () => {
    expect(await setArchived("person-1", false)).toEqual({ ok: true });
    expect(peopleUpdate).toHaveBeenCalledWith({ archived_at: null });
  });
});

describe("deletePerson", () => {
  beforeEach(() => {
    deletePersonResult.data = [{ id: "person-1" }];
    deletePersonResult.error = null;
  });

  it("reports the owner-only message when the delete affects no rows", async () => {
    deletePersonResult.data = [];
    expect(await deletePerson("person-1")).toEqual({
      error: "Solo la propietaria puede eliminar personas.",
    });
  });

  it("reports the wards message for a 23503 foreign key violation", async () => {
    deletePersonResult.data = null;
    deletePersonResult.error = { code: "23503" };
    expect(await deletePerson("person-1")).toEqual({
      error: "No se puede eliminar: tiene menores a su cargo.",
    });
  });
});
