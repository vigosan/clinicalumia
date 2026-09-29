import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, string>;

let tables: Record<string, Row[]>;
let authUsers: { id: string; email: string }[];
let requestHeaders: Headers;
let otpError: { message: string; status?: number; code?: string } | null;
let verifyError: { message: string } | null;
const createUser = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const redirectMock = vi.fn();

function table(name: string) {
  const filters: [string, "eq" | "gte" | "lte", string][] = [];
  const rows = () =>
    (tables[name] ?? []).filter((row) =>
      filters.every(([column, op, value]) =>
        op === "eq"
          ? row[column] === value
          : op === "gte"
            ? (row[column] ?? "") >= value
            : (row[column] ?? "") <= value,
      ),
    );
  const builder = {
    select: () =>
      Object.assign(Promise.resolve({ data: rows(), error: null }), builder),
    eq: (column: string, value: string) => {
      filters.push([column, "eq", value]);
      return builder;
    },
    gte: (column: string, value: string) => {
      filters.push([column, "gte", value]);
      return Object.assign(
        Promise.resolve({ count: rows().length, error: null }),
        builder,
      );
    },
    lte: async (column: string, value: string) => {
      filters.push([column, "lte", value]);
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
    delete: () => ({
      eq: async (column: string, value: string) => {
        tables[name] = (tables[name] ?? []).filter(
          (row) => row[column] !== value,
        );
        return { error: null };
      },
      lt: async (column: string, value: string) => {
        tables[name] = (tables[name] ?? []).filter(
          (row) => (row[column] ?? "") >= value,
        );
        return { error: null };
      },
    }),
    upsert: async (row: Row) => {
      if (!(tables[name] ?? []).some((existing) => existing.id === row.id)) {
        tables[name] = [...(tables[name] ?? []), row];
      }
      return { error: null };
    },
  };
  return builder;
}

vi.mock("@/lib/site", () => ({
  site: { url: "https://web.clinicalumia.test" },
}));
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

const { confirmLink, requestAccess, verifyCode } = await import("./actions");

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
    origin: "https://evil.example",
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
          "https://web.clinicalumia.test/acceder/confirmar?next=%2Freservar",
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

  it("records each email request as a request, apart from wrong codes", async () => {
    await requestAccess(undefined, accessForm("lucia@example.com"));

    expect(tables.access_requests).toEqual([
      expect.objectContaining({ email: "lucia@example.com", kind: "request" }),
    ]);
  });

  it("does not count wrong codes against asking for a new email", async () => {
    tables.access_requests = Array.from({ length: 5 }, () => ({
      email: "lucia@example.com",
      ip_hash: "otra-red",
      kind: "failed_code",
      created_at: new Date().toISOString(),
    }));

    await requestAccess(undefined, accessForm("lucia@example.com"));

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
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
            "https://web.clinicalumia.test/acceder/confirmar?next=%2F",
        }),
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/acceder/codigo?email=lucia%40example.com&next=%2F",
    );
  });

  it("builds the emailed link from the web's own address, never from a header the visitor controls", async () => {
    await requestAccess(undefined, accessForm("lucia@example.com"));

    const [{ options }] = signInWithOtp.mock.lastCall ?? [];
    expect(options.emailRedirectTo).toMatch(
      /^https:\/\/web\.clinicalumia\.test\//,
    );
  });

  it("purges attempts older than a day so the table only keeps what the limits need", async () => {
    const hours = (n: number) =>
      new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
    tables.access_requests = [
      { email: "vieja@example.com", ip_hash: "h", created_at: hours(25) },
      { email: "reciente@example.com", ip_hash: "h", created_at: hours(23) },
    ];

    await requestAccess(undefined, accessForm("lucia@example.com"));

    expect(
      (tables.access_requests ?? []).map((row) => row.email).sort(),
    ).toEqual(["lucia@example.com", "reciente@example.com"]);
  });

  it("still leads to the code screen when a repeat request comes too soon, because the code already sent keeps working", async () => {
    otpError = {
      status: 429,
      code: "over_email_send_rate_limit",
      message:
        "For security purposes, you can only request this after 42 seconds.",
    };

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toBeUndefined();
    expect(redirectMock).toHaveBeenCalledWith(
      "/acceder/codigo?email=lucia%40example.com&next=%2Freservar",
    );
  });

  it("reports too many attempts when Supabase's hourly email quota is spent, instead of pretending an email went out", async () => {
    otpError = {
      status: 429,
      code: "over_email_send_rate_limit",
      message: "email rate limit exceeded",
    };

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toEqual(TOO_MANY);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports too many attempts when Supabase limits the server's requests", async () => {
    otpError = {
      status: 429,
      code: "over_request_rate_limit",
      message: "Request rate limit reached",
    };

    const result = await requestAccess(
      undefined,
      accessForm("lucia@example.com"),
    );

    expect(result).toEqual(TOO_MANY);
    expect(redirectMock).not.toHaveBeenCalled();
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
    tables = { access_requests: [] };
    fromIp("203.0.113.7");
    vi.stubEnv("ACCESS_IP_SALT", "sal-de-prueba");
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

  it("records each wrong code against the email and the network", async () => {
    verifyError = { message: "Token has expired or is invalid" };

    await verifyCode(undefined, codeForm("Lucia@Example.com", "000000"));

    expect(tables.access_requests).toEqual([
      expect.objectContaining({
        email: "lucia@example.com",
        ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        kind: "failed_code",
      }),
    ]);
  });

  it("records the attempt before checking the code, so parallel guesses cannot all slip under the limit", async () => {
    let recordedBeforeVerify = false;
    verifyOtp.mockImplementation(async () => {
      recordedBeforeVerify = (tables.access_requests ?? []).some(
        (row) =>
          row.email === "lucia@example.com" && row.kind === "failed_code",
      );
      return { error: null };
    });

    await verifyCode(undefined, codeForm("lucia@example.com", "123456"));

    expect(recordedBeforeVerify).toBe(true);
  });

  it("lets at most five of many simultaneous wrong codes reach Supabase", async () => {
    verifyError = { message: "Token has expired or is invalid" };

    await Promise.all(
      Array.from({ length: 8 }, () =>
        verifyCode(undefined, codeForm("lucia@example.com", "000000")),
      ),
    );

    expect(verifyOtp.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("keeps blocked attempts on record so hammering never reopens the limit", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    for (let attempt = 0; attempt < 7; attempt++) {
      await verifyCode(undefined, codeForm("lucia@example.com", "000000"));
    }

    expect(tables.access_requests).toHaveLength(7);
    expect(verifyOtp).toHaveBeenCalledTimes(5);
  });

  it("does not record anything when the code is right", async () => {
    await verifyCode(undefined, codeForm("lucia@example.com", "123456"));

    expect(tables.access_requests).toHaveLength(0);
  });

  it("stops checking codes for an email after five wrong ones in an hour, so six digits cannot be guessed", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    for (let attempt = 0; attempt < 5; attempt++) {
      fromIp(`198.51.100.${attempt}`);
      await verifyCode(undefined, codeForm("lucia@example.com", "000000"));
    }
    verifyError = null;
    verifyOtp.mockClear();

    const result = await verifyCode(
      undefined,
      codeForm("lucia@example.com", "123456"),
    );

    expect(result).toEqual(TOO_MANY);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("still accepts the right code after four wrong ones", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    for (let attempt = 0; attempt < 4; attempt++) {
      await verifyCode(undefined, codeForm("lucia@example.com", "000000"));
    }
    verifyError = null;

    await verifyCode(undefined, codeForm("lucia@example.com", "123456"));

    expect(redirectMock).toHaveBeenCalledWith("/reservar");
  });

  it("stops a network after thirty wrong codes in an hour, even spread over many emails", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    for (let attempt = 0; attempt < 30; attempt++) {
      await verifyCode(
        undefined,
        codeForm(`persona-${attempt}@example.com`, "000000"),
      );
    }
    verifyOtp.mockClear();

    const blocked = await verifyCode(
      undefined,
      codeForm("otra@example.com", "123456"),
    );
    fromIp("192.0.2.1");
    await verifyCode(undefined, codeForm("otra-mas@example.com", "123456"));

    expect(blocked).toEqual(TOO_MANY);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("forgets wrong codes older than an hour", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    tables.access_requests = Array.from({ length: 5 }, () => ({
      email: "lucia@example.com",
      ip_hash: "otra-red",
      kind: "failed_code",
      created_at: twoHoursAgo,
    }));

    await verifyCode(undefined, codeForm("lucia@example.com", "123456"));

    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("does not count email requests as wrong codes", async () => {
    tables.access_requests = Array.from({ length: 5 }, () => ({
      email: "lucia@example.com",
      ip_hash: "otra-red",
      kind: "request",
      created_at: new Date().toISOString(),
    }));

    await verifyCode(undefined, codeForm("lucia@example.com", "123456"));

    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("sends an external next to the home page", async () => {
    await verifyCode(
      undefined,
      codeForm("lucia@example.com", "123456", "//evil.example/robar"),
    );

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

describe("confirmLink", () => {
  beforeEach(() => {
    verifyError = null;
    verifyOtp.mockReset();
    verifyOtp.mockImplementation(async () => ({ error: verifyError }));
    redirectMock.mockClear();
  });

  function linkForm(tokenHash: string, next: string) {
    const data = new FormData();
    data.set("token_hash", tokenHash);
    data.set("next", next);
    return data;
  }

  it("opens the session only when the person presses the button, and returns to where they were", async () => {
    await confirmLink(linkForm("hash-1", "/reservar?hueco=1"));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-1",
      type: "email",
    });
    expect(redirectMock).toHaveBeenCalledWith("/reservar?hueco=1");
  });

  it("sends a used or expired link back to ask for a new one", async () => {
    verifyError = { message: "Email link is invalid or has expired" };

    await confirmLink(linkForm("usado", "/reservar"));

    expect(redirectMock).toHaveBeenCalledWith("/acceder?caducado=1");
  });

  it("never follows an external next", async () => {
    await confirmLink(linkForm("hash-1", "https://evil.example"));

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
