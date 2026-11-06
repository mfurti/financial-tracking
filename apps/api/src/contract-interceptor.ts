import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { apiContracts } from '@financial-tracking/contracts';
import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

/** Validate and strip public responses against the shared operation contracts. */
@Injectable()
export class ContractInterceptor implements NestInterceptor {
  /** Validate output after controller execution and before JSON serialization. */
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const path = request.routeOptions.url?.replace('/api/v1', '').replace(':id', '{id}');
    const contract = Object.values(apiContracts).find(
      /** Match registered routes, not query text. */ (operation) =>
        operation.method === request.method.toLowerCase() && operation.path === path,
    );
    if (!contract) throw new AppError('MISSING_CONTRACT', 'Interner Schnittstellenfehler.', 500);
    return next.handle().pipe(
      map(
        /** Strip unknown fields and hide invalid response values. */ (value: unknown) => {
          const parsed = contract.response.safeParse(value);
          if (!parsed.success) throw new AppError('INVALID_RESPONSE', 'Interner Schnittstellenfehler.', 500);
          return parsed.data;
        },
      ),
    );
  }
}
