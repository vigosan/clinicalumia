import { beforeEach, describe, expect, it, vi } from "vitest";

const insertResult: {
  data: { id: string } | null;
  error: { code: string; message?: string } | null;
} = { data: null, error: null };
const updateResult: {
  data: { id: string }[] | null;
  error: { code: string; message?: string } | null;
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
const ownerResult: { data: boolean | null; error: null } = {
  data: true,
  error: null,
};
const rpc = vi.fn(async (name: string) =>
  name === "is_owner" ? ownerResult : rpcResult,
);

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
    rpcResult.data = [];
    rpcResult.error = null;
    rpc.mockClear();
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
    ).toEqual({ error: "Ya hay una ficha con ese DNI/NIE." });
  });

  it("links the DNI message to the record that already has that DNI, even an archived one, so the team can open it instead of getting stuck", async () => {
    insertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "people_tax_id_key"',
    };
    rpcResult.data = [
      {
        id: "person-phone",
        first_name: "Otra",
        last_name: "Persona",
        matched: ["phone"],
        archived: false,
        wards: [],
      },
      {
        id: "person-archived",
        first_name: "Jorge",
        last_name: "Ruiz",
        matched: ["tax_id"],
        archived: true,
        wards: [],
      },
    ];
    expect(
      await savePerson(undefined, personForm({ tax_id: "11.223.344-b" })),
    ).toEqual({
      error: "Ya hay una ficha con ese DNI/NIE.",
      existingId: "person-archived",
    });
    expect(rpc).toHaveBeenCalledWith("find_possible_duplicates", {
      p_tax_id: "11223344B",
      p_email: "",
      p_phone: "",
      p_exclude: undefined,
    });
  });

  it("when an edit collides with another record's DNI, links to that other record and never to the one being edited", async () => {
    updateResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "people_tax_id_key"',
    };
    rpcResult.data = [
      {
        id: "person-other",
        first_name: "Jorge",
        last_name: "Ruiz",
        matched: ["tax_id"],
        archived: false,
        wards: [],
      },
    ];
    expect(
      await savePerson(
        undefined,
        personForm({ id: "person-1", tax_id: "11223344B" }),
      ),
    ).toEqual({
      error: "Ya hay una ficha con ese DNI/NIE.",
      existingId: "person-other",
    });
    expect(rpc).toHaveBeenCalledWith(
      "find_possible_duplicates",
      expect.objectContaining({ p_exclude: "person-1" }),
    );
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

describe("savePerson with a consent", () => {
  const consentId = "7b0c7c1e-2f3a-4c5d-8e9f-0a1b2c3d4e5f";
  const personId = "0f9e8d7c-6b5a-4938-8271-605f4e3d2c1b";

  beforeEach(() => {
    insertResult.data = { id: personId };
    insertResult.error = null;
    rpcResult.data = null;
    rpcResult.error = null;
    rpc.mockClear();
    vi.mocked(redirect).mockClear();
  });

  it("links the signed consent to the new record and goes back to it, so the consent stops waiting as pending", async () => {
    await savePerson(undefined, personForm({ consent_id: consentId }));
    expect(rpc).toHaveBeenCalledWith("link_consent", {
      p_consent_id: consentId,
      p_person_id: personId,
    });
    expect(vi.mocked(redirect).mock.calls[0]).toEqual([
      `/consentimientos/${consentId}`,
    ]);
  });

  it("does not link anything on a plain creation, so normal records never get someone else's consent", async () => {
    await savePerson(undefined, personForm());
    expect(rpc).not.toHaveBeenCalledWith("link_consent", expect.anything());
    expect(vi.mocked(redirect).mock.calls[0]).toEqual([
      `/patients/${personId}`,
    ]);
  });

  it("ignores a consent id that is not a uuid, since it comes from the address bar", async () => {
    await savePerson(undefined, personForm({ consent_id: "not-a-uuid" }));
    expect(rpc).not.toHaveBeenCalledWith("link_consent", expect.anything());
    expect(vi.mocked(redirect).mock.calls[0]).toEqual([
      `/patients/${personId}`,
    ]);
  });

  it("keeps the new record and shows why on the consent when linking fails, e.g. someone linked it meanwhile", async () => {
    rpcResult.error = { message: "consent_already_linked" };
    await savePerson(undefined, personForm({ consent_id: consentId }));
    expect(vi.mocked(redirect).mock.calls[0]).toEqual([
      `/consentimientos/${consentId}?linkError=already-linked`,
    ]);
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
    ).toEqual({ error: "El tutor/a tiene que ser mayor de edad." });
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
    ).toEqual({ error: "Ya tiene tutor/a principal." });
    expect(peopleInsert).not.toHaveBeenCalled();
  });
});

describe("checkDuplicates", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpcResult.data = [];
    rpcResult.error = null;
  });

  it("passes the parameters straight through to the RPC, including the name and birth date so minors without contact data are matched", async () => {
    await checkDuplicates({
      tax_id: "12345678Z",
      email: "ana@example.com",
      phone: "600111222",
      first_name: "Ana",
      last_name: "García",
      birth_date: "2000-01-01",
      exclude: "person-1",
    });
    expect(rpc).toHaveBeenCalledWith("find_possible_duplicates", {
      p_tax_id: "12345678Z",
      p_email: "ana@example.com",
      p_phone: "600111222",
      p_first_name: "Ana",
      p_last_name: "García",
      p_birth_date: "2000-01-01",
      p_exclude: "person-1",
    });
  });

  it("sends no birth date when the field is empty, since an empty string is not a date", async () => {
    await checkDuplicates({
      tax_id: "",
      email: "",
      phone: "600111222",
      first_name: "Ana",
      last_name: "García",
      birth_date: "",
    });
    expect(rpc).toHaveBeenCalledWith(
      "find_possible_duplicates",
      expect.objectContaining({ p_birth_date: undefined }),
    );
  });

  it("returns an empty list when the RPC fails, since the warning is a help and not a barrier", async () => {
    rpcResult.error = { message: "boom" };
    expect(
      await checkDuplicates({
        tax_id: "",
        email: "",
        phone: "",
        first_name: "",
        last_name: "",
        birth_date: "",
      }),
    ).toEqual([]);
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
      error: "Nadie puede ser su propio tutor/a.",
    });
    expect(guardianshipsInsert).not.toHaveBeenCalled();
  });

  it("rejects a guardian who is still a minor", async () => {
    guardianLookupResult.data = { birth_date: "2015-01-01" };
    expect(await addGuardian("minor-1", "guardian-1", "madre", false)).toEqual({
      error: "El tutor/a tiene que ser mayor de edad.",
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
      error: "Ya tiene tutor/a principal.",
    });
  });

  it("reports an already-a-guardian message for the guardianships_pkey constraint", async () => {
    guardianshipInsertResult.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "guardianships_pkey"',
    };
    expect(await addGuardian("minor-1", "guardian-1", "madre", false)).toEqual({
      error: "Ya es tutor/a de este menor.",
    });
  });
});

describe("removeGuardian", () => {
  beforeEach(() => {
    guardianshipDeleteResult.data = [{ minor_id: "minor-1" }];
    guardianshipDeleteResult.error = null;
    ownerResult.data = true;
  });

  it("refuses an employee before touching the guardianship, since only the owner removes guardians", async () => {
    ownerResult.data = false;
    guardianshipsDelete.mockClear();
    expect(await removeGuardian("minor-1", "guardian-1")).toEqual({
      error: "Solo la propietaria puede quitar tutores.",
    });
    expect(guardianshipsDelete).not.toHaveBeenCalled();
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
      error: "No se ha podido quitar el tutor/a.",
    });
  });
});

describe("setArchived", () => {
  beforeEach(() => {
    updateResult.data = [{ id: "person-1" }];
    updateResult.error = null;
    peopleUpdate.mockClear();
    rpcResult.data = [];
    rpcResult.error = null;
    ownerResult.data = true;
    rpc.mockClear();
  });

  it("refuses an employee archiving or restoring a record without listing appointments she should not see", async () => {
    ownerResult.data = false;
    for (const archived of [true, false]) {
      expect(await setArchived("person-1", archived)).toEqual({
        error: "Solo la propietaria puede archivar o desarchivar fichas.",
      });
    }
    expect(rpc).not.toHaveBeenCalledWith(
      "person_upcoming_appointments",
      expect.anything(),
    );
    expect(peopleUpdate).not.toHaveBeenCalled();
  });

  it("refuses to archive someone with upcoming appointments and lists them, so no appointment is left for a hidden record", async () => {
    rpcResult.data = [
      {
        id: "appointment-1",
        starts_at: "2026-12-24T09:30:00+00:00",
        professional_name: "Laura Ejemplo",
      },
    ];

    expect(await setArchived("person-1", true)).toEqual({
      error: "Cancela o mueve antes estas citas.",
      appointments: [
        {
          id: "appointment-1",
          when: "24/12/2026 10:30",
          professional: "Laura Ejemplo",
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("person_upcoming_appointments", {
      p_person_id: "person-1",
    });
    expect(peopleUpdate).not.toHaveBeenCalled();
  });

  it("explains the refusal when an appointment is given between the check and the archive and the database refuses it", async () => {
    updateResult.data = null;
    updateResult.error = {
      code: "23514",
      message: "person_has_upcoming_appointments",
    };

    expect(await setArchived("person-1", true)).toEqual({
      error: "Cancela o mueve antes estas citas.",
    });
  });

  it("does not archive when it cannot check the upcoming appointments", async () => {
    rpcResult.data = null;
    rpcResult.error = { message: "boom" };

    expect(await setArchived("person-1", true)).toEqual({
      error: "No se han podido comprobar sus citas pendientes.",
    });
    expect(peopleUpdate).not.toHaveBeenCalled();
  });

  it("does not look for appointments when restoring a record", async () => {
    await setArchived("person-1", false);
    expect(rpc).not.toHaveBeenCalledWith(
      "person_upcoming_appointments",
      expect.anything(),
    );
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
      error: "Solo la propietaria puede eliminar fichas.",
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
      error:
        "No se puede eliminar: tiene citas, cobros o consentimientos. Archívala.",
    });
  });
});
