import { describe, expect, it } from 'vitest';
import { demoStateSchema, seedDemoState } from '../apps/web/app/utils/demo-state.js';
import { demoPrice, demoTotal, transitionDemo, type DemoAction } from '../apps/web/app/utils/demo-finance.js';

/** Fixed explicit action clock makes pure finance examples reproducible. */
const at = '2026-11-30T12:00:00.000Z';
/** Standard synthetic order never references a real account or quote. */
const buy: DemoAction = { kind: 'buy', accountId: 'demo-cash', securityId: 'demo-world', quantity: 2 };
/** Valid monthly plan has enough budget for one whole synthetic share. */
const plan = {
  id: 'demo-plan',
  name: 'Demo Sparplan',
  accountId: 'demo-cash',
  securityId: 'demo-world',
  amountCents: '20000',
  day: 31,
};

describe('isolated exact synthetic finance', /** Exercise state invariants without a browser, API or database. */ () => {
  it('seeds fresh JSON-only state and exactly conserves value across buy/sell/transfer', /** Trading at synthetic quotes does not mint aggregate value or history. */ () => {
    const original = seedDemoState();
    const snapshot = JSON.stringify(original);
    const bought = transitionDemo(original, buy, 'demo-buy', at);
    expect(bought.accounts[0]!.cashCents).toBe('975310');
    expect(bought.positions[0]!.quantity).toBe(12);
    expect(bought.orders[0]!.priceCents).toBe('12345');
    const sold = transitionDemo(bought, { ...buy, kind: 'sell', quantity: 12 }, 'demo-sell', at);
    expect(sold.positions).toEqual([]);
    expect(sold.accounts[0]!.cashCents).toBe('1123450');
    const transferred = transitionDemo(
      sold,
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-savings', amountCents: '12345' },
      'demo-transfer',
      at,
    );
    expect(transferred.accounts[1]!.cashCents).toBe('262345');
    expect(demoTotal(transferred)).toBe(demoTotal(original));
    expect(transferred.history).toEqual(original.history);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(seedDemoState()).toEqual(original);
    expect(transferred.revision).toBe(3);
  });

  it.each([0, -1, 1.5, 1001, NaN, Infinity, '2'])(
    'rejects malformed order quantity %s without partial mutation',
    /** Validation precedes private draft changes. */ (quantity) => {
      const state = seedDemoState(),
        before = JSON.stringify(state);
      expect(() => transitionDemo(state, { ...buy, quantity }, 'demo-invalid', at)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it('rejects insufficient cash/holdings, identical transfers, unknown and real references atomically', /** Every unsuccessful operation preserves all fields. */ () => {
    const state = seedDemoState(),
      before = JSON.stringify(state);
    const invalid: unknown[] = [
      { ...buy, quantity: 1000 },
      { ...buy, kind: 'sell', quantity: 11 },
      { ...buy, accountId: 'e242d79f-5040-4582-bc50-fd166bb1fb5c' },
      { ...buy, securityId: 'demo-unknown' },
      { ...buy, accountId: 'demo-unknown' },
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-cash', amountCents: '1' },
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-savings', amountCents: '1000001' },
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-savings', amountCents: '0' },
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-unknown', amountCents: '1' },
      { kind: 'account', name: 'x', cashCents: '100' },
    ];
    for (const action of invalid) {
      expect(() => transitionDemo(state, action, 'demo-invalid', at)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('handles money beyond Number precision, exact scenario rounding and both scenario bounds', /** Only counts and basis points use Number arithmetic. */ () => {
    const state = seedDemoState();
    state.accounts[0]!.cashCents = '900719925474099301';
    const next = transitionDemo(state, buy, 'demo-large', at);
    expect(next.accounts[0]!.cashCents).toBe('900719925474074611');
    expect(demoTotal(next)).toBe(demoTotal(state));
    const lower = transitionDemo(state, { kind: 'scenario', basisPoints: -3000 }, 'demo-low', at);
    expect(demoPrice(lower, 'demo-world')).toBe(8642n);
    const upper = transitionDemo(lower, { kind: 'scenario', basisPoints: 3000 }, 'demo-high', at);
    expect(demoPrice(upper, 'demo-world')).toBe(16049n);
    for (const basisPoints of [-3001, 3001, 0.5])
      expect(() => transitionDemo(state, { kind: 'scenario', basisPoints }, 'demo-bad', at)).toThrow();
  });

  it('records only changed aggregate values and retains the most recent 48', /** Repeated unchanged valuations cannot fabricate extra observations. */ () => {
    let state = seedDemoState();
    expect(transitionDemo(state, { kind: 'scenario', basisPoints: 0 }, 'demo-flat', at).history).toEqual(state.history);
    for (let index = 1; index <= 60; index++)
      state = transitionDemo(state, { kind: 'scenario', basisPoints: index * 10 }, `demo-value-${index}`, at);
    expect(state.history).toHaveLength(48);
    expect(state.history[0]!.id).toBe('demo-value-13');
    expect(state.history.at(-1)!.totalCents).toBe(demoTotal(state).toString());
    const replay = transitionDemo(state, { kind: 'scenario', basisPoints: 600 }, 'demo-value-60', at);
    expect(replay).toEqual(state);
  });

  it('creates zero-cash accounts/categories and display-only roles without changing valuation', /** Synthetic metadata cannot provide cash funding or authorization. */ () => {
    const initial = seedDemoState();
    let state = transitionDemo(initial, { kind: 'account', name: '  Neues Demo-Konto  ' }, 'demo-new-account', at);
    state = transitionDemo(state, { kind: 'category', name: 'Demo Kategorie' }, 'demo-new-category', at);
    state = transitionDemo(
      state,
      { kind: 'role', id: 'demo-owner', name: 'Demo Leser', role: 'viewer' },
      'demo-role',
      at,
    );
    expect(state.accounts.at(-1)).toEqual({ id: 'demo-new-account', name: 'Neues Demo-Konto', cashCents: '0' });
    expect(state.categories.at(-1)!.name).toBe('Demo Kategorie');
    expect(state.roles[0]!.role).toBe('viewer');
    expect(demoTotal(state)).toBe(demoTotal(initial));
    expect(state.history).toEqual(initial.history);
  });

  it('executes plans explicitly, floors whole shares and retains period receipts through edits/deletion', /** Day 31 clamps to month end; a new command cannot repeat an executed period. */ () => {
    const original = seedDemoState();
    let state = transitionDemo(original, { kind: 'plan-save', plan }, 'demo-save', at);
    expect(state.orders).toHaveLength(0);
    expect(() =>
      transitionDemo(
        state,
        { kind: 'plan-execute', planId: plan.id, period: '2026-11' },
        'demo-early',
        '2026-11-29T12:00:00.000Z',
      ),
    ).toThrow(/Ausführungstag/);
    state = transitionDemo(state, { kind: 'plan-execute', planId: plan.id, period: '2026-11' }, 'demo-execute', at);
    expect(state.orders[0]!.quantity).toBe(1);
    expect(state.accounts[0]!.cashCents).toBe('987655');
    expect(state.executedPeriods).toEqual(['demo-plan:2026-11']);
    expect(() =>
      transitionDemo(state, { kind: 'plan-execute', planId: plan.id, period: '2026-11' }, 'demo-again', at),
    ).toThrow(/bereits/);
    state = transitionDemo(state, { kind: 'plan-delete', planId: plan.id }, 'demo-delete', at);
    state = transitionDemo(state, { kind: 'plan-save', plan: { ...plan, amountCents: '40000' } }, 'demo-recreate', at);
    expect(() =>
      transitionDemo(state, { kind: 'plan-execute', planId: plan.id, period: '2026-11' }, 'demo-after-edit', at),
    ).toThrow(/bereits/);
    expect(state.history).toEqual(original.history);
  });

  it.each(['0', '1', '12345001'])(
    'rejects non-executable plan amount %s without booking a period',
    /** Amount validity and executable whole-share limits are distinct. */ (amountCents) => {
      const state = seedDemoState();
      if (amountCents === '0') {
        expect(() =>
          transitionDemo(state, { kind: 'plan-save', plan: { ...plan, amountCents } }, 'demo-save', at),
        ).toThrow();
        return;
      }
      const saved = transitionDemo(state, { kind: 'plan-save', plan: { ...plan, amountCents } }, 'demo-save', at);
      const snapshot = JSON.stringify(saved);
      expect(() =>
        transitionDemo(saved, { kind: 'plan-execute', planId: plan.id, period: '2026-11' }, 'demo-run', at),
      ).toThrow();
      expect(JSON.stringify(saved)).toBe(snapshot);
    },
  );

  it('uses Berlin execution days and clamps leap February', /** Calendar execution follows Berlin rather than UTC midnight. */ () => {
    const saved = transitionDemo(seedDemoState(), { kind: 'plan-save', plan }, 'demo-save', at);
    const leap = transitionDemo(
      saved,
      { kind: 'plan-execute', planId: plan.id, period: '2028-02' },
      'demo-leap',
      '2028-02-28T23:30:00.000Z',
    );
    expect(leap.executedPeriods).toContain('demo-plan:2028-02');
    expect(() =>
      transitionDemo(
        saved,
        { kind: 'plan-execute', planId: plan.id, period: '2028-02' },
        'demo-early-leap',
        '2028-02-28T22:30:00.000Z',
      ),
    ).toThrow(/Ausführungstag/);
  });

  it('rejects corrupt schema, altered catalog, duplicate/dangling holdings and unrelated real data', /** Persistence must validate the entire payload before financial use. */ () => {
    const state = seedDemoState();
    expect(demoStateSchema.safeParse({ ...state, session: 'forbidden' }).success).toBe(false);
    expect(demoStateSchema.safeParse({ ...state, schemaVersion: 2 }).success).toBe(false);
    expect(demoStateSchema.safeParse({ ...state, positions: [...state.positions, ...state.positions] }).success).toBe(
      false,
    );
    expect(
      demoStateSchema.safeParse({ ...state, positions: [{ ...state.positions[0], accountId: 'demo-missing' }] })
        .success,
    ).toBe(false);
    state.securities[0]!.priceCents = '1';
    expect(demoStateSchema.safeParse(state).success).toBe(false);
  });
});
