import { z } from 'zod';
import { type Session } from '@financial-tracking/contracts';
import { ApiError, publicApiError } from '../utils/api-error';
import { displayMoney, displayDate, displayTimestamp } from '../utils/financial-display';
import { displayLocale, amountsMasked, tr } from './useWorkspaceLocale';

/** Typed same-origin API transport with shared runtime response validation. */
export function useApi() {
  const session = useState<Session | null>('session', /** Keep session/CSRF data in memory only. */ () => null);
  const config = useRuntimeConfig();
  const route = useRoute();
  const router = useRouter();
  const popup = useFinancePopup();
  /** Submit an authenticated request and validate the JSON boundary. */
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
      body?: unknown;
      query?: Record<string, string | number | undefined>;
    } = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const finishMutation = method === 'GET' ? undefined : popup?.trackMutation();
    try {
      const response = await $fetch<unknown>(`${config.public.apiBase}${path}`, {
        method,
        body: options.body as Record<string, unknown> | undefined,
        query: options.query,
        credentials: 'same-origin',
        headers: session.value ? { 'x-csrf-token': session.value.csrfToken } : {},
      });
      finishMutation?.();
      return schema.parse(response);
    } catch (error: unknown) {
      if (error instanceof z.ZodError)
        throw new ApiError(
          tr('Die Serverantwort konnte nicht verarbeitet werden. Bitte lade die Ansicht neu und versuche es erneut.'),
          'INVALID_RESPONSE',
          502,
        );
      const details = error as { statusCode?: number; data?: unknown };
      const failure = publicApiError(details.data, details.statusCode);
      // A rejected current password follows successful session authentication and does not revoke that session.
      const reauthenticationFailed = path === '/auth/password' && failure.code === 'INVALID_LOGIN';
      if (details.statusCode === 401 && !reauthenticationFailed) {
        session.value = null;
        if (route.path !== '/login') await router.push('/login');
      }
      throw failure;
    }
  }
  return { request, session };
}

/** Format BIGINT cent strings without rounding through JavaScript numbers. */
export function money(cents: string | bigint) {
  return displayMoney(cents, displayLocale() === 'en-GB' ? 'en' : 'de', amountsMasked());
}

/** Format a source calendar date without shifting it to the previous day. */
export function calendarDate(date: string) {
  return displayDate(date, displayLocale() === 'en-GB' ? 'en' : 'de');
}

/** Display a real timestamp in the user's configured timezone. */
export function observedTime(timestamp: string | null) {
  return timestamp
    ? displayTimestamp(timestamp, displayLocale() === 'en-GB' ? 'en' : 'de')
    : tr('Noch nicht aktualisiert');
}

/** Label a calendar month in German without shifting its first day across timezones. */
export function monthName(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return tr('Monat auswählen');
  return new Intl.DateTimeFormat(displayLocale(), { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

/** Reuse one inclusive calendar-month range for links and transaction queries. */
export function monthRangeQuery(month: string): Record<string, string> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return {};
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { from: `${month}-01`, to: end.toISOString().slice(0, 10) };
}
