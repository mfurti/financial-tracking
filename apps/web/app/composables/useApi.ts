import { z } from 'zod';
import { errorSchema, type Session } from '@financial-tracking/contracts';

/** Typed same-origin API transport with shared runtime response validation. */
export function useApi() {
  const session = useState<Session | null>('session', /** Keep session/CSRF data in memory only. */ () => null);
  const config = useRuntimeConfig();
  const route = useRoute();
  const router = useRouter();
  /** Submit an authenticated request and validate the JSON boundary. */
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      body?: unknown;
      query?: Record<string, string | number | undefined>;
    } = {},
  ): Promise<T> {
    try {
      const response = await $fetch<unknown>(`${config.public.apiBase}${path}`, {
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | undefined,
        query: options.query,
        credentials: 'same-origin',
        headers: session.value ? { 'x-csrf-token': session.value.csrfToken } : {},
      });
      return schema.parse(response);
    } catch (error: unknown) {
      const details = error as { statusCode?: number; data?: unknown };
      if (details.statusCode === 401) {
        session.value = null;
        if (route.path !== '/login') await router.push('/login');
      }
      const safe = errorSchema.safeParse(details.data);
      throw new Error(safe.success ? safe.data.error.message : 'Anfrage fehlgeschlagen. Bitte erneut versuchen.');
    }
  }
  return { request, session };
}

/** Format BIGINT cent strings without rounding through JavaScript numbers. */
export function money(cents: string | bigint) {
  const amount = BigInt(cents),
    absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '−' : ''}${(absolute / 100n).toLocaleString('de-DE')},${String(absolute % 100n).padStart(2, '0')} €`;
}

/** Format a source calendar date without shifting it to the previous day. */
export function calendarDate(date: string) {
  return date.split('-').reverse().join('.');
}

/** Display a real timestamp in the user's configured timezone. */
export function observedTime(timestamp: string | null) {
  return timestamp
    ? new Date(timestamp).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    : 'Noch nicht aktualisiert';
}
