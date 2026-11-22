import { Fields, QueryService, type BaseDelegate, type Delegate, type FieldSchema } from '@querry-kit/nest/core';
import type { ZodType } from 'zod';
import { AppError } from './errors.js';

/** Decode the pinned table client's bounded JSON parameters before checking their domain allowlists. */
export function tableJson<T>(param: string | undefined, schema: ZodType<T>, fallback: unknown): T {
  let value = fallback;
  if (param !== undefined) {
    try {
      value = JSON.parse(param);
    } catch {
      throw new AppError('INVALID_INPUT', 'Ungültige Tabellenabfrage.', 400);
    }
  }
  return schema.parse(value);
}

/** Restrict projection to row fields and always preserve the stable row identity and full page metadata. */
export function tableFields(fields: string | undefined, schema: FieldSchema) {
  if (fields === undefined) return undefined;
  const projected = Fields.parseAndValidate(fields, schema, { allowNested: true, requireIncludeForRelations: false });
  if (projected && !Object.keys(projected).length) throw new AppError('INVALID_INPUT', 'Ungültige Feldauswahl.', 400);
  return projected?.id ? fields : `id,${fields}`;
}

/** Use Querry Kit pagination with a server-owned predicate already typed for the Prisma delegate. */
export class ScopedTableQuery<TDelegate extends BaseDelegate> extends QueryService<TDelegate> {
  /** Hold the same validated predicate for count and selection. */
  constructor(
    delegate: Delegate<TDelegate>,
    private readonly scopedWhere: unknown,
  ) {
    super(delegate);
  }

  /** Preserve exact search strings, Date objects, and BIGINTs through the library's generic query normalization. */
  protected override mergeAbilityWhere() {
    return this.scopedWhere;
  }
}
