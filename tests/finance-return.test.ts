import { it, expect } from 'vitest';
import { financeReturnTarget } from '../apps/web/app/utils/finance-return.js';

it('retains validated local financial scope and rejects arbitrary return destinations', /** Bookmarked return links never authorize redirects outside the supported financial views. */ () => {
  expect(
    financeReturnTarget('/analytics/details?from=2026-10-01&to=2026-10-31&merchantKey=unknown&direction=INCOME'),
  ).toContain('merchantKey=unknown&direction=INCOME');
  expect(financeReturnTarget('/transactions?unassigned=true&merchantKey=unknown&excludeTransfers=true')).toContain(
    'merchantKey=unknown',
  );
  for (const value of [
    null,
    ['bad'],
    'https://other.invalid',
    '//other.invalid/transactions',
    '/login',
    '/analytics/details?from=invalid&to=2026-10-31',
    '/analytics/details?from=2026-11-01&to=2026-10-31',
    '/transactions?accountId=bad',
  ])
    expect(financeReturnTarget(value)).toBeNull();
});
