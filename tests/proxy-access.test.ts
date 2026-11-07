import { describe, expect, it } from 'vitest';
import { isTrustedProxy } from '../apps/web/server/utils/proxy-access.js';

describe('proxy peer boundary', /** Forwarded headers cannot turn a direct socket into the configured proxy. */ () => {
  /** Resolve a synthetic proxy without depending on the host's DNS configuration. */
  async function resolve() {
    return [{ address: '172.19.0.10', family: 4 }];
  }
  it('accepts the proxy and rejects a direct LAN peer or missing peer', /** Compare the actual socket only. */ async () => {
    expect(await isTrustedProxy('::ffff:172.19.0.10', 'traefik', resolve)).toBe(true);
    expect(await isTrustedProxy('192.168.178.20', 'traefik', resolve)).toBe(false);
    expect(await isTrustedProxy(undefined, 'traefik', resolve)).toBe(false);
  });
  it('fails closed when the configured proxy cannot be resolved', /** A broken dependency must not open Macvlan access. */ async () => {
    expect(
      await isTrustedProxy(
        '192.168.178.20',
        'traefik',
        /** Model an unavailable Docker resolver. */ async () => {
          throw new Error('DNS unavailable');
        },
      ),
    ).toBe(false);
  });
});
