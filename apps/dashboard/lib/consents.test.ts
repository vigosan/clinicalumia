import { describe, expect, it, vi } from "vitest";
import {
  CONSENTS_PAGE_SIZE,
  consentsListHref,
  consentsListParams,
  consentsListResult,
  consentsPageCount,
  formatSignedAt,
  hasPendingConsents,
  linkedPersonLabel,
  listConsents,
} from "./consents";

describe("consentsListParams", () => {
  it("shows only pending consents by default when there are some, so nothing waits unnoticed", () => {
    expect(consentsListParams({}, true)).toEqual({
      q: "",
      pendingOnly: true,
      page: 1,
    });
  });

  it("shows every consent by default when none is pending, so the list is never empty for no reason", () => {
    expect(consentsListParams({}, false).pendingOnly).toBe(false);
  });

  it("respects an explicit choice over the default", () => {
    expect(consentsListParams({ pendientes: "0" }, true).pendingOnly).toBe(
      false,
    );
    expect(consentsListParams({ pendientes: "1" }, false).pendingOnly).toBe(
      true,
    );
  });

  it("falls back to the first page when the page number is missing or nonsense", () => {
    expect(consentsListParams({ pagina: "3" }, false).page).toBe(3);
    expect(consentsListParams({ pagina: "0" }, false).page).toBe(1);
    expect(consentsListParams({ pagina: "abc" }, false).page).toBe(1);
    expect(consentsListParams({ pagina: "-2" }, false).page).toBe(1);
  });

  it("keeps the search text", () => {
    expect(consentsListParams({ q: "lucía" }, false).q).toBe("lucía");
  });
});

describe("consentsListHref", () => {
  it("always states the filter explicitly, so moving between pages never flips it back to the default", () => {
    expect(consentsListHref({ q: "", pendingOnly: false, page: 2 })).toBe(
      "/consentimientos?pendientes=0&pagina=2",
    );
    expect(consentsListHref({ q: "ana", pendingOnly: true, page: 1 })).toBe(
      "/consentimientos?q=ana&pendientes=1",
    );
  });
});

describe("consentsPageCount", () => {
  it("pages in blocks of 25 and always has at least one page", () => {
    expect(CONSENTS_PAGE_SIZE).toBe(25);
    expect(consentsPageCount(0)).toBe(1);
    expect(consentsPageCount(25)).toBe(1);
    expect(consentsPageCount(26)).toBe(2);
  });
});

describe("formatSignedAt", () => {
  it("shows the Madrid date and time the patient signed, not the UTC one", () => {
    expect(formatSignedAt("2026-09-30T22:30:00Z")).toBe("01/10/2026 00:30");
  });
});

describe("linkedPersonLabel", () => {
  it("names the person, and warns when the record was archived so staff know why it is hidden elsewhere", () => {
    expect(
      linkedPersonLabel({
        first_name: "Lucía",
        last_name: "Martínez",
        archived_at: null,
      }),
    ).toBe("Lucía Martínez");
    expect(
      linkedPersonLabel({
        first_name: "Lucía",
        last_name: "Martínez",
        archived_at: "2026-09-01T00:00:00Z",
      }),
    ).toBe("Lucía Martínez (archivada)");
  });
});

function fakeClient(count = 0) {
  const result = { data: [], error: null, count };
  const query = Object.assign(Promise.resolve(result), {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    is: vi.fn(() => query),
    ilike: vi.fn(() => query),
  });
  const from = vi.fn(() => query);
  return { client: { from }, from, query };
}

describe("listConsents", () => {
  it("reads the requested page of 25, newest first", async () => {
    const { client, from, query } = fakeClient();
    await listConsents(client as never, { q: "", pendingOnly: false, page: 2 });
    expect(from).toHaveBeenCalledWith("consents");
    expect(query.order).toHaveBeenCalledWith("signed_at", {
      ascending: false,
    });
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(query.is).not.toHaveBeenCalled();
    expect(query.ilike).not.toHaveBeenCalled();
  });

  it("keeps only consents without a person when filtering pending ones", async () => {
    const { client, query } = fakeClient();
    await listConsents(client as never, { q: "", pendingOnly: true, page: 1 });
    expect(query.is).toHaveBeenCalledWith("person_id", null);
    expect(query.range).toHaveBeenCalledWith(0, 24);
  });

  it("searches name and DNI the way the patient search does, ignoring accents and DNI separators", async () => {
    const { client, query } = fakeClient();
    await listConsents(client as never, {
      q: "Lucía",
      pendingOnly: false,
      page: 1,
    });
    expect(query.ilike).toHaveBeenCalledWith("search_text", "%lucia%");

    const dni = fakeClient();
    await listConsents(dni.client as never, {
      q: "11.223.344",
      pendingOnly: false,
      page: 1,
    });
    expect(dni.query.ilike).toHaveBeenCalledWith("search_text", "%11223344%");
  });
});

describe("hasPendingConsents", () => {
  it("counts only consents still waiting for a person", async () => {
    const pending = fakeClient(2);
    expect(await hasPendingConsents(pending.client as never)).toBe(true);
    expect(pending.query.is).toHaveBeenCalledWith("person_id", null);

    expect(await hasPendingConsents(fakeClient(0).client as never)).toBe(false);
  });
});

describe("consentsListResult", () => {
  it("shows an empty page, not a load error, when the page number is past the end", () => {
    expect(
      consentsListResult({
        data: null,
        error: { code: "PGRST103" },
        count: null,
      }),
    ).toEqual({ consents: [], failed: false, total: 0 });
  });

  it("reports any other failure as a load error", () => {
    expect(
      consentsListResult({ data: null, error: { code: "XX000" }, count: null })
        .failed,
    ).toBe(true);
  });

  it("passes rows and total through", () => {
    expect(
      consentsListResult({ data: [{ id: "a" }], error: null, count: 30 }),
    ).toEqual({ consents: [{ id: "a" }], failed: false, total: 30 });
  });
});
