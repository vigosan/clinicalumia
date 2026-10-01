import { describe, expect, it } from "vitest";
import { withAge } from "./person-search";

describe("withAge", () => {
  it("turns the birth date into the age on the given Madrid day, so a birthday today already counts", () => {
    expect(
      withAge(
        {
          id: "p1",
          first_name: "Nora",
          last_name: "Martínez",
          birth_date: "2018-10-01",
          phone: "+34600111222",
        },
        "2026-10-01",
      ),
    ).toEqual({
      id: "p1",
      first_name: "Nora",
      last_name: "Martínez",
      birth_date: "2018-10-01",
      age: 8,
      phone: "+34600111222",
    });
  });

  it("leaves the age empty for a record without birth date, instead of showing a wrong number", () => {
    expect(
      withAge(
        {
          id: "p2",
          first_name: "Vecina",
          last_name: "Sin Fecha",
          birth_date: null,
          phone: null,
        },
        "2026-10-01",
      ).age,
    ).toBeNull();
  });
});
