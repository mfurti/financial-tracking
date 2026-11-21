/** Supported device display languages; currency stays EUR and dates stay Berlin calendar dates. */
export type WorkspaceLanguage = 'de' | 'en';

/** Format signed integer cents exactly; masking happens before any value is exposed to the renderer. */
export function displayMoney(cents: string | bigint, language: WorkspaceLanguage, masked: boolean): string {
  if (masked) return language === 'en' ? 'Amount hidden' : 'Betrag ausgeblendet';
  const amount = BigInt(cents);
  const absolute = amount < 0n ? -amount : amount;
  const major = (absolute / 100n).toLocaleString(language === 'en' ? 'en-GB' : 'de-DE');
  const minor = String(absolute % 100n).padStart(2, '0');
  return `${amount < 0n ? '−' : ''}${language === 'en' ? `€${major}.${minor}` : `${major},${minor} €`}`;
}

/** Validate a literal calendar date and format it without converting through a local timezone. */
export function displayDate(value: string, language: WorkspaceLanguage): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return '—';
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—';
  return value
    .split('-')
    .reverse()
    .join(language === 'en' ? '/' : '.');
}

/** Render actual instants in Berlin, independently of the browser's timezone. */
export function displayTimestamp(value: string, language: WorkspaceLanguage): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
