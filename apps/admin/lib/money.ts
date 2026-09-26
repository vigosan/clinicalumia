export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/€/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
