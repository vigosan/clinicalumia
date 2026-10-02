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
let tableError: { message: string } | null;
let listError: { message: string } | null;
let undeletable: string[];
const deleteUser = vi.fn();
const listUsers = vi.fn();

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
          if (tableError) return { data: null, error: tableError };
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
  tableError = null;
  listError = null;
  undeletable = [];
  deleteUser.mockReset();
  listUsers.mockReset();
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
    tableError = { message: "caída" };

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
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await run()).toEqual({ deleted: 1, failed: 1 });
    expect(deleteUser).toHaveBeenCalledWith("abandonada");
  });
});
