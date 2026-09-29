import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };

const rpc = vi.fn<(name: string, args: unknown) => Promise<RpcResult>>();
vi.mock("@clinicalumia/api/anon", () => ({
  createAnonClient: () => ({ rpc }),
}));

const { GET } = await import("./route");

const TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

function request(segment: string) {
  return new Request(`http://localhost:3001/calendario/${segment}`);
}

function context(token: string) {
  return { params: Promise.resolve({ token }) };
}

function answer(owner: string | null, feed: unknown[] = []) {
  rpc.mockImplementation(async (name) =>
    name === "calendar_owner"
      ? { data: owner, error: null }
      : { data: feed, error: null },
  );
}

const FEED_ROW = {
  appointment_id: "77777777-7777-7777-7777-777777777777",
  starts_at: "2026-10-02T07:00:00+00:00",
  ends_at: "2026-10-02T07:45:00+00:00",
  updated_at: "2026-09-20T10:15:00+00:00",
  summary: "Marta López · Sesión de logopedia",
};

beforeEach(() => {
  rpc.mockReset();
});

describe("GET /calendario/[token]", () => {
  it("does not exist for an unknown or replaced token, so a leaked old link reveals nothing", async () => {
    answer(null);

    const response = await GET(
      request(`${TOKEN}.ics`),
      context(`${TOKEN}.ics`),
    );

    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalledWith("calendar_feed", expect.anything());
  });

  it("looks the token up without the .ics suffix calendar apps need in the link", async () => {
    answer("Ana Torres");

    await GET(request(`${TOKEN}.ics`), context(`${TOKEN}.ics`));

    expect(rpc).toHaveBeenCalledWith("calendar_owner", { p_token: TOKEN });
    expect(rpc).toHaveBeenCalledWith("calendar_feed", { p_token: TOKEN });
  });

  it("does not exist without the .ics suffix, so there is a single link per token", async () => {
    answer("Ana Torres");

    const response = await GET(request(TOKEN), context(TOKEN));

    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("serves a valid token with no appointments as an empty calendar, so subscribing works from day one", async () => {
    answer("Ana Torres");

    const response = await GET(
      request(`${TOKEN}.ics`),
      context(`${TOKEN}.ics`),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).not.toContain("BEGIN:VEVENT");
  });

  it("serves the professional's appointments titled with her name, cached briefly and only by the subscriber", async () => {
    answer("Ana Torres", [FEED_ROW]);

    const response = await GET(
      request(`${TOKEN}.ics`),
      context(`${TOKEN}.ics`),
    );

    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    const body = await response.text();
    expect(body).toContain("X-WR-CALNAME:LUMIA · Ana Torres");
    expect(body).toContain(
      "UID:77777777-7777-7777-7777-777777777777@clinicalumia.es",
    );
    expect(body).toContain("DTSTART:20261002T070000Z");
    expect(body).toContain("DTEND:20261002T074500Z");
    expect(body).toContain("SUMMARY:Marta López · Sesión de logopedia");
  });

  it("stamps each event with its last change, so calendar apps notice a moved appointment", async () => {
    answer("Ana Torres", [FEED_ROW]);

    const response = await GET(
      request(`${TOKEN}.ics`),
      context(`${TOKEN}.ics`),
    );

    expect(await response.text()).toContain("DTSTAMP:20260920T101500Z");
  });
});
