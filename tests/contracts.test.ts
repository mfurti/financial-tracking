import { describe, expect, it } from 'vitest';
import {
  centsSchema,
  dateSchema,
  transactionQuerySchema,
  loginSchema,
  idSchema,
  ibanSchema,
} from '../packages/contracts/src/index.js';

describe('transport contracts', /** Exercise public constraints without implementation-specific snapshots. */ () => {
  it('normalizes spaced German IBANs and rejects invalid checksums', /** Shared account forms and the API enforce the same checksum. */ () => {
    expect(ibanSchema.parse('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
    for (const value of ['DE00370400440532013000', 'DE89370400440532013001', 'DE123', 'FR89370400440532013000'])
      expect(ibanSchema.safeParse(value).success).toBe(false);
  });
  it('canonicalizes UUIDs before identity-scope and duplicate-selection comparisons', /** PostgreSQL UUID case must not create distinct logical scopes. */ () => {
    const uppercase = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(idSchema.parse(uppercase)).toBe(uppercase.toLowerCase());
    expect(transactionQuerySchema.parse({ accountId: uppercase }).accountId).toBe(uppercase.toLowerCase());
  });
  it('preserves BIGINT precision and rejects overflow/float/exponential amounts', /** Validate lossless cent transport. */ () => {
    expect(centsSchema.parse('9223372036854775807')).toBe('9223372036854775807');
    for (const amount of ['9223372036854775808', '-9223372036854775809', '1.2', '1e6', '01'])
      expect(centsSchema.safeParse(amount).success).toBe(false);
  });
  it('rejects invalid dates and reversed ranges', /** Calendar dates must remain valid without timezone conversion. */ () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(transactionQuerySchema.safeParse({ from: '2026-11-02', to: '2026-11-01' }).success).toBe(false);
    expect(transactionQuerySchema.parse({}).limit).toBe(50);
    expect(transactionQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
  it('rejects empty login input', /** Form validation and server share the same input contract. */ () => {
    expect(loginSchema.safeParse({ username: ' ', password: '' }).success).toBe(false);
  });
});
