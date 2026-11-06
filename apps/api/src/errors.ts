import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/** Safe application error; never pass raw bank/database messages as its text. */
export class AppError extends HttpException {
  /** Preserve a public code and sanitized details. */
  constructor(
    readonly code: string,
    message: string,
    status = 422,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message, status);
  }
}

/** Convert errors without logging request bodies, credentials, or financial records. */
@Catch()
export class SafeErrors implements ExceptionFilter {
  /** Only public application errors and field paths may leave the API. */
  catch(error: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = error instanceof HttpException ? error.getStatus() : error instanceof ZodError ? 400 : 500;
    const details =
      error instanceof AppError
        ? error.details
        : error instanceof ZodError
          ? {
              fields: error.issues.map(
                /** Return paths, never rejected values or issue text containing those values. */
                (issue) => ({ path: issue.path.join('.'), code: issue.code }),
              ),
            }
          : {};
    void reply.status(status).send({
      error: {
        code:
          error instanceof AppError
            ? error.code
            : status === 400
              ? 'INVALID_INPUT'
              : status === 500
                ? 'INTERNAL_ERROR'
                : `HTTP_${status}`,
        message:
          error instanceof AppError ? error.message : status === 500 ? 'Interner Fehler.' : 'Anfrage nicht zulässig.',
        requestId: randomUUID(),
        details,
      },
    });
  }
}
