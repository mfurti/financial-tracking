import { z } from 'zod';
import { errorSchema } from '@financial-tracking/contracts';

const fieldsSchema = z.array(z.object({ path: z.string(), code: z.string() }));

/** Explain invalid local inputs without displaying schema JSON or rejected values. */
function validationMessage(fields: { path: string }[]) {
  if (
    fields.some(
      /** CSV mapping needs an actionable explanation before submission. */ (field) =>
        field.path.startsWith('mapping.'),
    )
  )
    return 'Bitte ordne Buchungsdatum, Betrag und Buchungstext jeweils einer Spalte deiner Datei zu.';
  return 'Bitte prüfe die markierten Eingaben und versuche es erneut.';
}

/** Public API failure preserving safe field paths and diagnostic identity without request values. */
export class ApiError extends Error {
  /** Keep the sanitized API payload available to forms and recoverable error states. */
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fields: { path: string; code: string }[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Parse only the agreed error boundary, never raw network/database text. */
export function publicApiError(data: unknown, status = 0) {
  const safe = errorSchema.safeParse(data);
  const fallback =
    status === 413
      ? 'Die Datei ist zu groß. Exportiere einen kleineren Zeitraum und versuche es erneut.'
      : status === 429
        ? 'Es gab zu viele Versuche in kurzer Zeit. Bitte warte einen Moment.'
        : status >= 500
          ? 'Der Dienst ist gerade nicht verfügbar. Bitte versuche es später erneut.'
          : status === 0
            ? 'Die Verbindung zum Server ist unterbrochen. Prüfe deine Netzwerkverbindung und lade die Ansicht neu.'
            : 'Die Anfrage konnte nicht ausgeführt werden. Bitte lade die Ansicht neu und versuche es erneut.';
  if (!safe.success) return new ApiError(fallback, 'REQUEST_FAILED', status);
  const fields = fieldsSchema.safeParse(safe.data.error.details.fields);
  const messages: Record<string, string> = {
    INVALID_INPUT: validationMessage(fields.success ? fields.data : []),
    INTERNAL_ERROR: 'Beim Verarbeiten ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    HTTP_401: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
    HTTP_403: 'Diese Aktion ist nicht erlaubt. Lade die Ansicht neu und melde dich gegebenenfalls erneut an.',
    HTTP_429: 'Es gab zu viele Versuche in kurzer Zeit. Bitte warte einen Moment.',
    CSV_TOO_LARGE: 'Die Datei ist zu groß. Exportiere einen kleineren Zeitraum mit höchstens 10 MiB.',
    CSV_TOO_MANY_ROWS: 'Die Datei enthält mehr als 50.000 Buchungen. Exportiere einen kleineren Zeitraum.',
    CSV_MAPPING:
      'Eine gewählte Spalte fehlt in der Datei. Bitte prüfe die Spaltenzuordnung und erstelle die Vorschau erneut.',
    CSV_STRUCTURE:
      'Die CSV-Datei konnte nicht in Spalten aufgeteilt werden. Prüfe Trennzeichen und Kopfzeile; bei beschädigten Anführungszeichen hilft ein neuer CSV-Export.',
  };
  return new ApiError(
    messages[safe.data.error.code] ?? (status >= 500 ? fallback : safe.data.error.message),
    safe.data.error.code,
    status,
    fields.success ? fields.data : [],
    safe.data.error.requestId,
  );
}

/** Show only known public errors and validation guidance, never an arbitrary exception message. */
export function userErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof z.ZodError)
    return validationMessage(
      cause.issues.map(/** Keep only safe field identities. */ (issue) => ({ path: issue.path.join('.') })),
    );
  return 'Die Aktion konnte nicht abgeschlossen werden. Bitte lade die Ansicht neu und versuche es erneut.';
}

/** Convert known validation failures into Nuxt UI field errors, excluding submitted values. */
export function formFieldErrors(cause: unknown) {
  const fields =
    cause instanceof ApiError
      ? cause.fields
      : cause instanceof z.ZodError
        ? cause.issues.map(
            /** Preserve the exact schema field association. */ (issue) => ({
              path: issue.path.join('.'),
              code: issue.code,
            }),
          )
        : [];
  return fields
    .filter(/** Root errors belong in the page alert. */ (field) => !!field.path)
    .map(
      /** Keep public feedback short and avoid echoing rejected input. */ (field) => ({
        name: field.path,
        message: 'Bitte Eingabe prüfen.',
      }),
    );
}
