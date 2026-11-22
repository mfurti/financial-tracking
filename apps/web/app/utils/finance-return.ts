import { analyticsDetailQuerySchema, transactionQuerySchema } from '@financial-tracking/contracts';
import { ledgerPageNumber, ledgerSort, transactionSortFields } from './ledger-table-route.js';

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
      const page = ledgerPageNumber(url.searchParams.get('page'), 1_000_000);
      const perPage = ledgerPageNumber(url.searchParams.get('perPage'), 100);
      const sort = ledgerSort(url.searchParams.get('sort'), transactionSortFields);
      if (page) params.set('page', String(page));
      if (perPage) params.set('perPage', String(perPage));
      if (sort.length) params.set('sort', JSON.stringify(sort));
    }
    const anchor = url.pathname === '/transactions' && /^#booking-[a-f0-9-]{36}$/i.test(url.hash) ? url.hash : '';
    return `${url.pathname}?${params}${anchor}`;
  } catch {
    return null;
  }
}
