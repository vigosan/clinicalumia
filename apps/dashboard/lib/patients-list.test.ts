import { describe, expect, it, vi } from "vitest";
import {
  listPatients,
  PATIENTS_PAGE_SIZE,
  patientsListHref,
  patientsListParams,
  patientsPageCount,
} from "./patients-list";

describe("patientsListParams", () => {
  it("starts on the first page of active records with no search", () => {
    expect(patientsListParams({})).toEqual({
      q: "",
      archived: false,
      page: 1,
    });
  });

  it("reads the search, the Archivados filter and the page from the URL, so a shared link opens the same list", () => {
    expect(
      patientsListParams({ q: "garcía", archived: "1", pagina: "3" }),
    ).toEqual({ q: "garcía", archived: true, page: 3 });
  });

  it("falls back to the first page for a page that is not a positive whole number", () => {
    expect(patientsListParams({ pagina: "0" }).page).toBe(1);
    expect(patientsListParams({ pagina: "-2" }).page).toBe(1);
    expect(patientsListParams({ pagina: "1.5" }).page).toBe(1);
    expect(patientsListParams({ pagina: "abc" }).page).toBe(1);
  });
});

describe("patientsListHref", () => {
  it("keeps the search and the filter when moving between pages, so paging never loses what you were looking for", () => {
    expect(patientsListHref({ q: "ana", archived: true, page: 2 })).toBe(
      "/patients?q=ana&archived=1&pagina=2",
    );
  });

  it("leaves the first page and the defaults out of the URL", () => {
    expect(patientsListHref({ q: "", archived: false, page: 1 })).toBe(
      "/patients",
    );
    expect(patientsListHref({ q: "ana", archived: false, page: 1 })).toBe(
      "/patients?q=ana",
    );
  });
});

describe("patientsPageCount", () => {
  it("pages in blocks of 25 and always has at least one page", () => {
    expect(PATIENTS_PAGE_SIZE).toBe(25);
    expect(patientsPageCount(0)).toBe(1);
    expect(patientsPageCount(25)).toBe(1);
    expect(patientsPageCount(26)).toBe(2);
  });
});

function fakeClient() {
  const result = { data: [], error: null, count: 0 };
  const query = Object.assign(Promise.resolve(result), {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    ilike: vi.fn(() => query),
  });
  const from = vi.fn(() => query);
  return { client: { from }, from, query };
}

describe("listPatients", () => {
  it("asks the database for just the requested page, with the total, instead of loading everyone", async () => {
    const { client, from, query } = fakeClient();
    await listPatients(client as never, { q: "", archived: false, page: 3 });

    expect(from).toHaveBeenCalledWith("people");
    expect(query.select).toHaveBeenCalledWith(expect.any(String), {
      count: "exact",
    });
    expect(query.range).toHaveBeenCalledWith(50, 74);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
    expect(query.ilike).not.toHaveBeenCalled();
  });

  it("orders by surname and then name, so a page boundary is stable", async () => {
    const { client, query } = fakeClient();
    await listPatients(client as never, { q: "", archived: false, page: 1 });

    expect(query.order).toHaveBeenNthCalledWith(1, "last_name", {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "first_name", {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(3, "id", { ascending: true });
  });

  it("shows only archived records under Archivados and searches ignoring accents", async () => {
    const { client, query } = fakeClient();
    await listPatients(client as never, {
      q: "Lucía",
      archived: true,
      page: 1,
    });

    expect(query.not).toHaveBeenCalledWith("archived_at", "is", null);
    expect(query.ilike).toHaveBeenCalledWith("search_text", "%lucia%");
    expect(query.range).toHaveBeenCalledWith(0, 24);
  });
});
