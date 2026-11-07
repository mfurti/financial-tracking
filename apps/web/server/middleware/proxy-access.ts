import { isTrustedProxy, peerAddress } from '../utils/proxy-access';

export default defineEventHandler(
  /** Prevent direct LAN/Macvlan requests from bypassing the existing proxy's access policy. */ async (event) => {
    const config = useRuntimeConfig(event);
    if (String(config.requireTrustedProxy) !== 'true') return;
    const peer = event.node.req.socket.remoteAddress;
    if (getRequestURL(event).pathname === '/health' && peer && ['127.0.0.1', '::1'].includes(peerAddress(peer))) return;
    if (!(await isTrustedProxy(peer, config.trustedProxyHost)))
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  },
);
