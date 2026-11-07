import { z } from 'zod';
import { errorSchema } from '@financial-tracking/contracts';

const fieldsSchema = z.array(z.object({ path: z.string(), code: z.string() }));

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
  if (!safe.success) return new ApiError('Anfrage fehlgeschlagen. Bitte erneut versuchen.', 'REQUEST_FAILED', status);
  const fields = fieldsSchema.safeParse(safe.data.error.details.fields);
  return new ApiError(
    safe.data.error.message,
    safe.data.error.code,
    status,
    fields.success ? fields.data : [],
    safe.data.error.requestId,
  );
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
