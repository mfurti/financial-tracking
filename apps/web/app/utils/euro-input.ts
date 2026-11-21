import { tr, displayLocale } from '../composables/useWorkspaceLocale.js';
/** Convert a user-entered nonnegative Euro amount to exact integer cents; never round through Number. */
export function euroCents(value: string) {
  const match = /^(\d{1,17})(?:[,.](\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error(tr('Betrag als Euro eingeben, zum Beispiel 12,99.'));
  return String(BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')));
}
/** Render exact cents in an editable Euro input without thousands separators. */
export function editableEuro(cents: string) {
  const value = BigInt(cents);
  return `${value / 100n}${displayLocale() === 'en-GB' ? '.' : ','}${String(value % 100n).padStart(2, '0')}`;
}
/** Round a contract-only planning equivalent to cents; this never contributes to observed expense averages. */
export function plannedEquivalent(amountCents: string, intervalMonths: number, months: 1 | 12) {
  if (![1, 3, 6, 12].includes(intervalMonths)) throw new Error(tr('Ungültiger Vertragsrhythmus.'));
  const divisor = BigInt(intervalMonths);
  return String((BigInt(amountCents) * BigInt(months) + divisor / 2n) / divisor);
}
