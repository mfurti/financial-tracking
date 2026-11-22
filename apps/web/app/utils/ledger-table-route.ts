/** Sort identifiers shared by the transaction table and its return bookmark. */
export const transactionSortFields = ['bookingDate', 'amountCents', 'description'] as const;

/** Accept only a bounded, positive decimal integer from a route query. */
export function ledgerPageNumber(value: unknown, max: number) {
  if (typeof value !== 'string' || !/^\d{1,7}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= 1 && number <= max ? number : undefined;
}

/** Decode at most three unique sorts for declared columns, keeping browse history safe and bounded. */
export function ledgerSort(value: unknown, fields: readonly string[]): { id: string; desc: boolean }[] {
  if (typeof value !== 'string' || value.length > 256) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(raw) || raw.length > 3) return [];
  const result: { id: string; desc: boolean }[] = [];
  for (const item of raw as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('id' in item) ||
      !('desc' in item) ||
      typeof item.id !== 'string' ||
      typeof item.desc !== 'boolean' ||
      !fields.includes(item.id) ||
      result.some(/** Each column can occur once in a stable order. */ (entry) => entry.id === item.id)
    )
      return [];
    result.push({ id: item.id, desc: item.desc });
  }
  return result;
}
