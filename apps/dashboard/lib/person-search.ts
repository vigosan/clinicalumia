import { ageOn } from "@clinicalumia/api/person";

export type PersonSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
};

export function withAge<T extends PersonSearchRow>(
  row: T,
  today: string,
): T & { age: number | null } {
  return {
    ...row,
    age: row.birth_date ? ageOn(row.birth_date, today) : null,
  };
}
