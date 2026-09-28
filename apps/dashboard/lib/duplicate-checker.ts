export type DuplicateFields = { tax_id: string; email: string; phone: string };

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
    const request = check(fields).then((found) => {
      result = found;
      return found;
    });
    pending = request;
    const found = await request;
    if (key === nextKey) pending = null;
    return found;
  }

  function markResolved(fields: DuplicateFields, found: D[]) {
    key = keyOf(fields);
    result = found;
    pending = null;
  }

  return { ensureResolved, markResolved };
}
