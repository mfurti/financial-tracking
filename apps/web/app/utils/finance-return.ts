import { analyticsDetailQuerySchema, transactionQuerySchema } from '@financial-tracking/contracts';

/** Accept only schema-validated local analysis/transaction return bookmarks, never arbitrary redirect targets. */
export function financeReturnTarget(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  try {
    const url = new URL(value, 'https://workspace.invalid');
    if (url.origin !== 'https://workspace.invalid') return null;
    const schema =
      url.pathname === '/analytics/details'
        ? analyticsDetailQuerySchema
        : url.pathname === '/transactions'
          ? transactionQuerySchema
          : null;
    if (!schema) return null;
    const query = schema.parse(Object.fromEntries(url.searchParams));
    const params = new URLSearchParams();
    for (const [key, entry] of Object.entries(query)) if (entry !== undefined) params.set(key, String(entry));
    if (url.pathname === '/transactions') {
      if (url.searchParams.get('period') === 'all' && !params.has('from') && !params.has('to'))
        params.set('period', 'all');
      if (url.searchParams.get('mode') === 'transfer') params.set('mode', 'transfer');
    }
    return `${url.pathname}?${params}`;
  } catch {
    return null;
  }
}
