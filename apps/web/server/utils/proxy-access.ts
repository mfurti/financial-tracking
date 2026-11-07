import { lookup } from 'node:dns/promises';

/** Normalize socket peers without accepting an HTTP forwarding header as identity. */
export function peerAddress(address: string) {
  return address.toLowerCase().replace(/^::ffff:/, '');
}

/** Accept only socket peers resolved for the configured proxy; DNS failures fail closed. */
export async function isTrustedProxy(
  remoteAddress: string | undefined,
  hostname: string,
  resolve: (name: string, options: { all: true }) => Promise<{ address: string; family: number }[]> = lookup,
) {
  if (!remoteAddress || !hostname) return false;
  try {
    const addresses = await resolve(hostname, { all: true });
    return addresses.some(
      /** Compare actual network addresses, including IPv4-mapped socket addresses. */ (entry) =>
        peerAddress(entry.address) === peerAddress(remoteAddress),
    );
  } catch {
    return false;
  }
}
