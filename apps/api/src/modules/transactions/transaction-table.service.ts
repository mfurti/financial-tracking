import { Inject, Injectable } from '@nestjs/common';
import { ResourceQuery, relation, type FieldSchema } from '@querry-kit/nest/core';
import {
  transactionTableFilterSchema,
  transactionTableOrderSchema,
  transactionTableRowSchema,
  type TablePageQuery,
} from '@financial-tracking/contracts';
import type { Db } from '../../db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { publicTransaction, transactionListWhere } from '../../ledger.js';
import { ScopedTableQuery, tableFields, tableJson } from '../../resource-table.js';

const include = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  contractPayment: { include: { contract: { select: { id: true, name: true } } } },
} satisfies Prisma.TransactionInclude;

/** The mapped relations expose only their public summary fields. */
const fields: FieldSchema = {
  ...Object.fromEntries(
    Object.keys(transactionTableRowSchema.shape).map(
      /** Use the shared row keys as the scalar field allowlist. */ (name) => [name, true],
    ),
  ),
  account: relation({ id: true, name: true }),
  category: relation({ id: true, name: true }),
  contract: true,
};

/** Execute the read on a stable database snapshot using the existing ledger scope. */
@Injectable()
export class TransactionTableService {
  /** Use the application's existing database session. */
  constructor(@Inject('DB') private readonly db: Db) {}

  /** Validate domain filters and map only declared table fields. */
  query(query: TablePageQuery) {
    const filter = tableJson(query.where, transactionTableFilterSchema, {});
    const sort = tableJson(query.orderBy, transactionTableOrderSchema, [{ bookingDate: 'desc' }]);
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [...sort, { id: 'desc' }];
    const projection = tableFields(query.fields, fields);
    return this.db.$transaction(
      /** Count and select from the same scoped database snapshot. */ async (tx) => {
        const where = await transactionListWhere(tx, filter);
        return ResourceQuery.query({
          service: new ScopedTableQuery<Prisma.TransactionDelegate>(tx.transaction, where),
          query: { page: query.page, perPage: query.perPage, fields: projection, orderBy },
          schema: fields,
          include,
          fields: { allowNested: true, requireIncludeForRelations: false },
          /** Serialize exact money and date values before the library projects them. */
          map: (row: Prisma.TransactionGetPayload<{ include: typeof include }>) =>
            transactionTableRowSchema.parse({
              ...publicTransaction(row),
              account: row.account,
              category: row.category,
            }),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
