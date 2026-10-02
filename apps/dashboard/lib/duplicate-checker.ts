export type DuplicateFields = {
  tax_id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  birth_date: string;
};

export function hasDuplicateInput(fields: DuplicateFields): boolean {
  if (fields.tax_id || fields.email || fields.phone) return true;
  return Boolean(fields.first_name && fields.last_name && fields.birth_date);
}

function keyOf(fields: DuplicateFields): string {
  return JSON.stringify(fields);
}

export function createDuplicateChecker<D>(
  check: (fields: DuplicateFields) => Promise<D[]>,
) {
  let key: string | null = null;
  let result: D[] = [];
  let pending: Promise<D[]> | null = null;

  async function ensureResolved(fields: DuplicateFields): Promise<D[]> {
    const nextKey = keyOf(fields);
    if (nextKey === key) return pending ?? result;

    key = nextKey;
    const request = check(fields);
    pending = request;
    try {
      const found = await request;
      result = found;
      return found;
    } catch (err) {
      key = null;
      throw err;
    } finally {
      if (pending === request) pending = null;
    }
  }

  function markResolved(fields: DuplicateFields, found: D[]) {
    key = keyOf(fields);
    result = found;
    pending = null;
  }

  return { ensureResolved, markResolved };
}
