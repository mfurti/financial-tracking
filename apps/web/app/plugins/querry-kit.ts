import { createApiClient } from '@querry-kit/nuxt/api';
import type { ZodType } from 'zod';
import { publicApiError } from '../utils/api-error';

/** Route Querry Kit table reads through this app's scoped, validated same-origin transport. */
export default defineNuxtPlugin(
  /** Obtain session and router state from this Nuxt app only. */ () => {
    const transport = useApi();

    /** Create a client that validates every response against the current table's public contract. */
    function createQueryClient<T>(schema: ZodType<T>) {
      const client = createApiClient({ apiBaseUrl: '' });
      client.defaults.adapter = /** Adapt Query Kit reads to the ledger API request lifecycle. */ async (config) => {
        if (config.method !== 'get') throw publicApiError(undefined, 405);
        const path = client.getUri({ ...config, baseURL: '' });
        // Table endpoints are app-defined paths. Reject absolute URLs and path traversal.
        if (!/^\/[a-z][a-z0-9-]*\/table(?:\?|$)/.test(path)) throw publicApiError(undefined, 400);
        const data = await transport.request(path, schema);
        return { data, config, status: 200, statusText: 'OK', headers: {} };
      };
      return client;
    }

    return { provide: { createQueryClient } };
  },
);
