import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUnverifiedAccounts } from "./unverified-accounts";

const NOW = new Date("2026-10-20T03:00:00.000Z");
const EIGHT_DAYS_AGO = "2026-10-12T02:00:00.000Z";
const SIX_DAYS_AGO = "2026-10-14T03:00:00.000Z";

type FakeUser = {
  id: string;
  created_at: string;
  last_sign_in_at?: string | null;
  invited_at?: string | null;
  recovery_sent_at?: string | null;
};

let users: FakeUser[];
let profileIds: string[];
let patientAccountIds: string[];
let failingTable: string | null;
let fresh: Record<string, Partial<FakeUser> | null>;
let listError: { message: string } | null;
let undeletable: string[];
const deleteUser = vi.fn();
const listUsers = vi.fn();
const getUserById = vi.fn();
const info = vi.fn();
const error = vi.fn();

function user(id: string, overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id,
    created_at: EIGHT_DAYS_AGO,
    last_sign_in_at: null,
    invited_at: null,
    recovery_sent_at: EIGHT_DAYS_AGO,
    ...overrides,
  };
}

function fakeAdmin() {
  return {
    auth: {
      admin: {
        listUsers: async ({
          page,
          perPage,
        }: {
          page: number;
          perPage: number;
        }) => {
          listUsers(page, perPage);
          if (listError) return { data: { users: [] }, error: listError };
          return {
            data: { users: users.slice((page - 1) * perPage, page * perPage) },
            error: null,
          };
        },
        getUserById: async (id: string) => {
          getUserById(id);
          const listed = users.find((candidate) => candidate.id === id);
          const current =
            id in fresh
              ? fresh[id] && listed && { ...listed, ...fresh[id] }
              : listed;
          if (!current)
            return {
              data: { user: null },
              error: { message: "User not found" },
            };
          return { data: { user: current }, error: null };
        },
        deleteUser: async (id: string) => {
          deleteUser(id);
          return {
            data: null,
            error: undeletable.includes(id) ? { message: "no" } : null,
          };
        },
      },
    },
    from: (table: string) => ({
      select: () => ({
        in: async (_column: string, ids: string[]) => {
          if (table === failingTable)
            return { data: null, error: { message: "caída" } };
          const existing =
            table === "profiles" ? profileIds : patientAccountIds;
          return {
            data: existing
              .filter((id) => ids.includes(id))
              .map((id) => ({ id })),
            error: null,
          };
        },
      }),
    }),
  };
}

async function run() {
  return deleteUnverifiedAccounts({ admin: fakeAdmin() as never, now: NOW });
}

beforeEach(() => {
  users = [];
  profileIds = [];
  patientAccountIds = [];
  failingTable = null;
  fresh = {};
  listError = null;
  undeletable = [];
  deleteUser.mockReset();
  listUsers.mockReset();
  getUserById.mockReset();
  info.mockReset();
  error.mockReset();
  vi.spyOn(console, "info").mockImplementation(info);
  vi.spyOn(console, "error").mockImplementation(error);
});

describe("deleteUnverifiedAccounts", () => {
  it("deletes a user who asked for a code more than a week ago and never used it, since it only holds an email nobody proved", async () => {
    users = [user("abandonada")];

    expect(await run()).toEqual({ deleted: 1, failed: 0 });
    expect(deleteUser).toHaveBeenCalledWith("abandonada");
  });

  it("keeps anyone who ever signed in, because they proved the email is theirs", async () => {
    users = [user("entro", { last_sign_in_at: EIGHT_DAYS_AGO })];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("keeps a user created less than a week ago, who may still be about to type the code", async () => {
    users = [
      user("reciente", { created_at: SIX_DAYS_AGO, recovery_sent_at: null }),
    ];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
  });

  it("keeps an old user who asked for a new code this week, so the cleanup never breaks a code that is on its way", async () => {
    users = [user("pidio-otro", { recovery_sent_at: SIX_DAYS_AGO })];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
  });

  it("keeps a user with a patient account, whatever their sign-in history", async () => {
    users = [user("paciente")];
    patientAccountIds = ["paciente"];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
  });

  it("keeps a team member, even one who never signed in", async () => {
    users = [user("equipo")];
    profileIds = ["equipo"];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
  });

  it("keeps an invited user, so a pending invitation is never cancelled behind the owner's back", async () => {
    users = [user("invitada", { invited_at: EIGHT_DAYS_AGO })];

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
  });

  it("looks through every page of users, not just the first", async () => {
    users = [
      ...Array.from({ length: 1000 }, (_, index) =>
        user(`entro-${index}`, { last_sign_in_at: EIGHT_DAYS_AGO }),
      ),
      user("abandonada"),
    ];

    expect(await run()).toEqual({ deleted: 1, failed: 0 });
    expect(listUsers).toHaveBeenCalledWith(2, 1000);
  });

  it("deletes nothing when it cannot tell who is a patient or team member, rather than risk deleting a real account", async () => {
    users = [user("abandonada")];
    failingTable = "profiles";

    await expect(run()).rejects.toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes nothing when the users cannot be listed", async () => {
    listError = { message: "caída" };

    await expect(run()).rejects.toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("keeps going after one deletion fails and reports it, so one bad row does not stop the cleanup", async () => {
    users = [user("bloqueada"), user("abandonada")];
    undeletable = ["bloqueada"];

    expect(await run()).toEqual({ deleted: 1, failed: 1 });
    expect(deleteUser).toHaveBeenCalledWith("abandonada");
  });

  it("deletes nothing when only the patient accounts cannot be read, since a real patient could be among the candidates", async () => {
    users = [user("abandonada")];
    failingTable = "patient_accounts";

    await expect(run()).rejects.toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes up to a hundred accounts in one run", async () => {
    users = [
      ...Array.from({ length: 100 }, (_, index) => user(`abandonada-${index}`)),
      ...Array.from({ length: 5 }, (_, index) => user(`equipo-${index}`)),
    ];
    profileIds = Array.from({ length: 5 }, (_, index) => `equipo-${index}`);

    expect(await run()).toEqual({ deleted: 100, failed: 0 });
  });

  it("deletes nothing and only reports the count when more than a hundred would go, because that many points to a bug or an attack rather than abandoned codes", async () => {
    users = Array.from({ length: 101 }, (_, index) =>
      user(`abandonada-${index}`),
    );

    expect(await run()).toEqual({ tooMany: 101 });
    expect(deleteUser).not.toHaveBeenCalled();
    const logged = error.mock.calls.flat().join(" ");
    expect(logged).toContain("101");
    expect(logged).not.toContain("abandonada-");
  });

  it("checks each user again right before deleting and keeps one who signed in meanwhile", async () => {
    users = [user("entro-ahora"), user("abandonada")];
    fresh = { "entro-ahora": { last_sign_in_at: NOW.toISOString() } };

    expect(await run()).toEqual({ deleted: 1, failed: 0 });
    expect(getUserById).toHaveBeenCalledWith("entro-ahora");
    expect(deleteUser).not.toHaveBeenCalledWith("entro-ahora");
  });

  it("keeps a user who asked for a new code between the listing and the deletion", async () => {
    users = [user("pidio-ahora")];
    fresh = { "pidio-ahora": { recovery_sent_at: NOW.toISOString() } };

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("skips a user that is already gone when re-checked, without counting it as a failure", async () => {
    users = [user("ya-borrada")];
    fresh = { "ya-borrada": null };

    expect(await run()).toEqual({ deleted: 0, failed: 0 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("logs how many accounts it deleted and failed on every run, so a quiet run is visible too", async () => {
    users = [user("abandonada")];

    await run();
    users = [];
    await run();

    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls[0]?.join(" ")).toContain('"deleted":1');
    expect(info.mock.calls[1]?.join(" ")).toContain('"deleted":0');
  });
});
