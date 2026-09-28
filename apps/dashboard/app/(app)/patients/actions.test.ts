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
const guardianLookupResult: {
  data: { birth_date: string | null } | null;
  error: null;
} = { data: { birth_date: null }, error: null };
const guardianshipInsertResult: {
  error: { code?: string; message?: string; details?: string } | null;
} = { error: null };
const deletePersonResult: {
  data: { id: string }[] | null;
  error: { code?: string; message?: string; details?: string } | null;
} = { data: [], error: null };
const primaryGuardianLookupResult: {
  data: { guardian_id: string } | null;
  error: null;
} = { data: null, error: null };

const insertSelectSingle = vi.fn(async () => insertResult);
const peopleInsert = vi.fn(() => ({
  select: () => ({ single: insertSelectSingle }),
}));
const updateEqSelect = vi.fn(async () => updateResult);
const updateEq = vi.fn(() => ({ select: updateEqSelect }));
const peopleUpdate = vi.fn(() => ({ eq: updateEq }));
const guardianMaybeSingle = vi.fn(async () => guardianLookupResult);
const guardianEq = vi.fn(() => ({ maybeSingle: guardianMaybeSingle }));
const peopleSelect = vi.fn(() => ({ eq: guardianEq }));
const deleteSelect = vi.fn(async () => deletePersonResult);
const deleteEq = vi.fn(() => ({ select: deleteSelect }));
const peopleDelete = vi.fn(() => ({ eq: deleteEq }));
const guardianshipsInsert = vi.fn(async () => guardianshipInsertResult);
const primaryGuardianMaybeSingle = vi.fn(
  async () => primaryGuardianLookupResult,
);
const primaryGuardianEq2 = vi.fn(() => ({
  maybeSingle: primaryGuardianMaybeSingle,
}));
const primaryGuardianEq1 = vi.fn(() => ({ eq: primaryGuardianEq2 }));
const guardianshipsSelect = vi.fn(() => ({ eq: primaryGuardianEq1 }));
const guardianshipDeleteResult: {
  data: { minor_id: string }[] | null;
  error: { code?: string } | null;
} = { data: [{ minor_id: "minor-1" }], error: null };
const guardianshipDeleteSelect = vi.fn(async () => guardianshipDeleteResult);
const guardianshipDeleteEq2 = vi.fn(() => ({
  select: guardianshipDeleteSelect,
}));
const guardianshipDeleteEq1 = vi.fn(() => ({ eq: guardianshipDeleteEq2 }));
const guardianshipsDelete = vi.fn(() => ({ eq: guardianshipDeleteEq1 }));
const rpc = vi.fn(async () => rpcResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { redirect } = await import("next/navigation");
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === "guardianships"
        ? {
            insert: guardianshipsInsert,
            delete: guardianshipsDelete,
            select: guardianshipsSelect,
          }
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
    return_to: "",
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
    vi.mocked(redirect).mockClear();
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

  it("redirects back to return_to with the new patient selected, so the appointment form does not lose its date/time/professional", async () => {
    await savePerson(
      undefined,
      personForm({
        return_to: "/appointments/new?date=2026-10-05&professional=prof-1",
      }),
    );
    expect(redirect).toHaveBeenCalledWith(
      "/appointments/new?date=2026-10-05&professional=prof-1&patient=person-1",
    );
  });

  it("ignores a return_to that does not point at /appointments/new, since that would be an open redirect", async () => {
    await savePerson(
      undefined,
      personForm({ return_to: "https://evil.example/steal" }),
    );
    expect(redirect).toHaveBeenCalledWith("/patients/person-1");
  });

  it("falls back to the patient page when there is no return_to", async () => {
    await savePerson(undefined, personForm());
    expect(redirect).toHaveBeenCalledWith("/patients/person-1");
  });
});

describe("savePerson with guardian_of", () => {
  beforeEach(() => {
    primaryGuardianLookupResult.data = null;
    peopleInsert.mockClear();
    guardianshipsSelect.mockClear();
  });

  it("rejects a new person under 18 as a guardian without creating anything", async () => {
    expect(
      await savePerson(
        undefined,
        personForm({
          guardian_of: "minor-1",
          birth_date: "2015-01-01",
        }),
      ),
    ).toEqual({ error: "Un tutor tiene que ser mayor de edad." });
    expect(peopleInsert).not.toHaveBeenCalled();
  });

  it("rejects a new primary guardian when the minor already has one, without creating anything", async () => {
    primaryGuardianLookupResult.data = { guardian_id: "existing-guardian" };
    expect(
      await savePerson(
        undefined,
        personForm({
          guardian_of: "minor-1",
          birth_date: "1980-01-01",
          is_primary: "on",
        }),
      ),
    ).toEqual({ error: "Ya tiene un tutor principal." });
    expect(peopleInsert).not.toHaveBeenCalled();
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
  beforeEach(() => {
    guardianshipDeleteResult.data = [{ minor_id: "minor-1" }];
    guardianshipDeleteResult.error = null;
  });

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

  it("reports it could not be removed when no row was deleted", async () => {
    guardianshipDeleteResult.data = [];
    expect(await removeGuardian("minor-1", "guardian-1")).toEqual({
      error: "No se ha podido quitar el tutor.",
    });
  });
});

describe("setArchived", () => {
  beforeEach(() => {
    updateResult.data = [{ id: "person-1" }];
    updateResult.error = null;
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

  it("reports it could not be updated when no row was changed", async () => {
    updateResult.data = [];
    expect(await setArchived("person-1", true)).toEqual({
      error: "No se ha podido actualizar.",
    });
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

  it("reports the wards message when the 23503 error names the guardianships_guardian_id_fkey constraint", async () => {
    deletePersonResult.data = null;
    deletePersonResult.error = {
      code: "23503",
      message:
        'update or delete on table "people" violates foreign key constraint "guardianships_guardian_id_fkey" on table "guardianships"',
    };
    expect(await deletePerson("person-1")).toEqual({
      error: "No se puede eliminar: tiene menores a su cargo.",
    });
  });

  it("reports a generic linked-data message for a 23503 error naming a different constraint", async () => {
    deletePersonResult.data = null;
    deletePersonResult.error = {
      code: "23503",
      message:
        'update or delete on table "people" violates foreign key constraint "appointments_person_id_fkey" on table "appointments"',
    };
    expect(await deletePerson("person-1")).toEqual({
      error: "No se puede eliminar: tiene datos ligados.",
    });
  });
});
