import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, string>;

let tables: Record<string, Row[]>;
let authUsers: { id: string; email: string }[];
let requestHeaders: Headers;
let otpError: { message: string } | null;
let verifyError: { message: string } | null;
const createUser = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const redirectMock = vi.fn();

function table(name: string) {
  const filters: [string, "eq" | "gte", string][] = [];
  const rows = () =>
    (tables[name] ?? []).filter((row) =>
      filters.every(([column, op, value]) =>
        op === "eq" ? row[column] === value : (row[column] ?? "") >= value,
      ),
    );
  const builder = {
    select: () =>
      Object.assign(Promise.resolve({ data: rows(), error: null }), builder),
    eq: (column: string, value: string) => {
      filters.push([column, "eq", value]);
      return builder;
    },
    gte: async (column: string, value: string) => {
      filters.push([column, "gte", value]);
      return { count: rows().length, error: null };
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    insert: (row: Row) => {
      const created = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      };
      tables[name] = [...(tables[name] ?? []), created];
      return {
        select: () => ({
          single: async () => ({ data: created, error: null }),
        }),
      };
    },
    upsert: async (row: Row) => {
      if (!(tables[name] ?? []).some((existing) => existing.id === row.id)) {
        tables[name] = [...(tables[name] ?? []), row];
      }
      return { error: null };
    },
  };
  return builder;
}

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));
vi.mock("@clinicalumia/api/admin", () => ({
  createAdminClient: () => ({
    from: table,
    auth: {
      admin: {
        createUser,
        listUsers: async () => ({ data: { users: authUsers }, error: null }),
      },
    },
  }),
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp, verifyOtp } }),
}));

const { requestAccess, verifyCode } = await import("./actions");

afterEach(() => {
  vi.unstubAllEnvs();
});

function accessForm(email: string, next = "/reservar") {
  const data = new FormData();
  data.set("email", email);
  data.set("next", next);
  return data;
}

function codeForm(email: string, code: string, next = "/reservar") {
  const data = new FormData();
  data.set("email", email);
  data.set("code", code);
  data.set("next", next);
  return data;
}

function fromIp(ip: string) {
  requestHeaders = new Headers({
    "x-forwarded-for": `${ip}, 10.0.0.1`,
    origin: "https://www.clinicalumia.es",
  });
}

const TOO_MANY = { error: "Demasiados intentos. Espera unos minutos." };
const STAFF = {
  error: "Esta dirección es del equipo de la clínica; entra desde el panel.",
};

describe("requestAccess", () => {
  beforeEach(() => {
    tables = { access_requests: [], profiles: [], patient_accounts: [] };
    authUsers = [];
    otpError = null;
    verifyError = null;
    fromIp("203.0.113.7");
    vi.stubEnv("ACCESS_IP_SALT", "sal-de-prueba");
    createUser.mockReset();
    createUser.mockImplementation(async ({ email }: { email: string }) => {
      if (authUsers.some((user) => user.email === email)) {
        return {
          data: { user: null },
          error: { code: "email_exists", message: "exists" },
        };
      }
      const user = { id: crypto.randomUUID(), email };
      authUsers.push(user);
      return { data: { user }, error: null };
    });
    signInWithOtp.mockReset();
    signInWithOtp.mockImplementation(async () => ({ error: otpError }));
    verifyOtp.mockReset();
    verifyOtp.mockImplementation(async () => ({ error: verifyError }));
    redirectMock.mockClear();
  });

  it("rejects a malformed email without touching the database or sending anything", async () => {
    const result = await requestAccess(undefined, accessForm("no-es-email"));

    expect(result).toEqual({ error: "Escribe un email válido." });
    expect(tables.access_requests).toHaveLength(0);
    expect(createUser).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("creates the account for a new email and sends a link that cannot create users on its own", async () => {
    await requestAccess(undefined, accessForm("  Lucia@Example.com "));

    expect(createUser).toHaveBeenCalledWith({
      email: "lucia@example.com",
      email_confirm: true,
    });
    const [user] = authUsers;
    expect(tables.patient_accounts).toEqual([
      { id: user?.id, email: "lucia@example.com" },
    ]);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "lucia@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "https://www.clinicalumia.es/acceder/confirmar?next=%2Freservar",
      },
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "/acceder/codigo?email=lucia%40example.com&next=%2Freservar",
    );
  });

  it("ensures the patient account of an existing user that had none, without creating another user", async () => {
    authUsers.push({ id: "existing-user", email: "marta@example.com" });

    await requestAccess(undefined, accessForm("marta@example.com"));

    expect(authUsers).toHaveLength(1);
    expect(tables.patient_accounts).toEqual([
      { id: "existing-user", email: "marta@example.com" },
    ]);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it("answers exactly the same whether the email already had an account or not, so nobody can probe who is a patient", async () => {
    tables.patient_accounts = [{ id: "u1", email: "ana@example.com" }];
    authUsers.push({ id: "u1", email: "ana@example.com" });

    const known = await requestAccess(undefined, accessForm("ana@example.com"));
    const knownRedirect = redirectMock.mock.lastCall?.[0];
    const unknown = await requestAccess(
      undefined,
      accessForm("nueva@example.com"),
    );
    const unknownRedirect = redirectMock.mock.lastCall?.[0];

    expect(known).toEqual(unknown);
    expect(knownRedirect).toBe(
      "/acceder/codigo?email=ana%40example.com&next=%2Freservar",
    );
    expect(unknownRedirect).toBe(
      "/acceder/codigo?email=nueva%40example.com&next=%2Freservar",
    );
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("rejects a team email, whatever its case, before creating any user or account", async () => {
    tables.profiles = [{ id: "staff-1", email: "Laura@ClinicaLumia.es" }];
    authUsers.push({ id: "staff-1", email: "laura@clinicalumia.es" });

    const result = await requestAccess(
      undefined,
      accessForm("laura@clinicalumia.es"),
    );

    expect(result).toEqual(STAFF);
    expect(createUser).not.toHaveBeenCalled();
    expect(tables.patient_accounts).toHaveLength(0);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects a team member whose sign-in email differs from the email on the profile", async () => {
    tables.profiles = [{ id: "staff-2", email: "antiguo@clinicalumia.es" }];
    authUsers.push({ id: "staff-2", email: "pablo@clinicalumia.es" });

    const result = await requestAccess(
      undefined,
      accessForm("pablo@clinicalumia.es"),
    );

    expect(result).toEqual(STAFF);
    expect(tables.patient_accounts).toHaveLength(0);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("stops the sixth request in an hour for the same email so the web cannot be used to flood an inbox", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      fromIp(`198.51.100.${attempt}`);
      await requestAccess(undefined, accessForm("lucia@example.com"));
    }
    fromIp("198.51.100.99");

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toEqual(TOO_MANY);
    expect(signInWithOtp).toHaveBeenCalledTimes(5);
    expect(tables.access_requests).toHaveLength(6);
  });

  it("keeps counting rejected attempts, so hammering past the limit never reopens it", async () => {
    for (let attempt = 0; attempt < 7; attempt++) {
      await requestAccess(undefined, accessForm("lucia@example.com"));
    }

    expect(tables.access_requests).toHaveLength(7);
    expect(signInWithOtp).toHaveBeenCalledTimes(5);
  });

  it("forgets requests older than an hour", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    tables.access_requests = Array.from({ length: 5 }, () => ({
      email: "lucia@example.com",
      ip_hash: "otra-red",
      created_at: twoHoursAgo,
    }));

    await requestAccess(undefined, accessForm("lucia@example.com"));

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it("stops the twenty-first request in an hour from the same network, even with different emails", async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      await requestAccess(
        undefined,
        accessForm(`persona-${attempt}@example.com`),
      );
    }

    const blocked = await requestAccess(
      undefined,
      accessForm("otra@example.com"),
    );
    fromIp("192.0.2.1");
    const elsewhere = await requestAccess(
      undefined,
      accessForm("otra-mas@example.com"),
    );

    expect(blocked).toEqual(TOO_MANY);
    expect(elsewhere).toBeUndefined();
    expect(signInWithOtp).toHaveBeenCalledTimes(21);
  });

  it("stores only a salted hash of the network address, never the address itself", async () => {
    await requestAccess(undefined, accessForm("lucia@example.com"));
    vi.stubEnv("ACCESS_IP_SALT", "otra-sal");
    await requestAccess(undefined, accessForm("lucia@example.com"));

    const [first, second] = tables.access_requests ?? [];
    expect(first?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first?.ip_hash).not.toContain("203.0.113.7");
    expect(second?.ip_hash).not.toBe(first?.ip_hash);
  });

  it("refuses to run in production without a salt instead of storing guessable hashes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACCESS_IP_SALT", "");

    await expect(
      requestAccess(undefined, accessForm("lucia@example.com")),
    ).rejects.toThrow("ACCESS_IP_SALT");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends an external next back to the home page so the link cannot bounce people off-site", async () => {
    await requestAccess(
      undefined,
      accessForm("lucia@example.com", "https://evil.example"),
    );

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo:
            "https://www.clinicalumia.es/acceder/confirmar?next=%2F",
        }),
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/acceder/codigo?email=lucia%40example.com&next=%2F",
    );
  });

  it("still leads to the code screen when a repeat request comes too soon, because the code already sent keeps working", async () => {
    otpError = { message: "only request this after 58 seconds" };
    signInWithOtp.mockImplementation(async () => ({
      error: { ...otpError, status: 429 },
    }));

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toBeUndefined();
    expect(redirectMock).toHaveBeenCalledWith(
      "/acceder/codigo?email=lucia%40example.com&next=%2Freservar",
    );
  });

  it("tells the person to retry when the email could not be sent", async () => {
    otpError = { message: "smtp down" };

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toEqual({
      error: "No hemos podido enviarte el email. Inténtalo de nuevo.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("verifyCode", () => {
  beforeEach(() => {
    verifyError = null;
    verifyOtp.mockReset();
    verifyOtp.mockImplementation(async () => ({ error: verifyError }));
    redirectMock.mockClear();
  });

  it("opens the session with the emailed code and returns to where the person was", async () => {
    await verifyCode(
      undefined,
      codeForm(" Lucia@Example.com", " 123456 ", "/reservar?hueco=1"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "lucia@example.com",
      token: "123456",
      type: "email",
    });
    expect(redirectMock).toHaveBeenCalledWith("/reservar?hueco=1");
  });

  it("explains a wrong or expired code without redirecting", async () => {
    verifyError = { message: "Token has expired or is invalid" };

    const result = await verifyCode(
      undefined,
      codeForm("lucia@example.com", "000000"),
    );

    expect(result).toEqual({
      error: "El código no es correcto o ha caducado.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sends an external next to the home page", async () => {
    await verifyCode(
      undefined,
      codeForm("lucia@example.com", "123456", "//evil.example/robar"),
    );

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
