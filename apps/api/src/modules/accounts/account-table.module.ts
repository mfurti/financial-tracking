import { Controller, Get, Inject, Injectable, Module, Query, type DynamicModule } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceQuery, type FieldSchema } from '@querry-kit/nest/core';
import {
  accountTableFilterSchema,
  accountTableItemSchema,
  accountTableOrderSchema,
  tablePageQuerySchema,
} from '@financial-tracking/contracts';
import type { Db } from '../../db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { accountReadInclude, publicAccount } from '../../ledger.js';
import { resolveAccountScope } from '../../account-scope.js';
import { ScopedTableQuery, tableFields, tableJson } from '../../resource-table.js';

const fields: FieldSchema = Object.fromEntries(
  Object.keys(accountTableItemSchema.shape).map(
    /** Expose only fields from the account list contract. */ (name) => [name, true],
  ),
);

/** Resolve scoped account table reads. */
@Injectable()
class AccountTableService {
  /** Use the application-owned database. */
  constructor(@Inject('DB') private readonly db: Db) {}

  /** Resolve visibility before selecting and counting public account rows. */
  query(raw: unknown) {
    const query = tablePageQuerySchema.parse(raw);
    const filter = tableJson(query.where, accountTableFilterSchema, {});
    const sort = tableJson(query.orderBy, accountTableOrderSchema, [{ name: 'asc' }]);
    const projection = tableFields(query.fields, fields);
    return this.db.$transaction(
      /** Preserve the count and page of the same scope and observation snapshot. */ async (tx) => {
        const where: Prisma.AccountWhereInput = {
          id: (await resolveAccountScope(tx, filter)) ?? undefined,
          name: filter.search ? { contains: filter.search, mode: 'insensitive' } : undefined,
          isActive: filter.isActive,
          accountType: filter.accountType,
        };
        return ResourceQuery.query({
          service: new ScopedTableQuery<Prisma.AccountDelegate>(tx.account, where),
          query: { page: query.page, perPage: query.perPage, fields: projection, orderBy: [...sort, { id: 'desc' }] },
          schema: fields,
          include: accountReadInclude,
          /** Return latest observations without bank credentials or identifiers for private account configuration. */
          map: (row: Prisma.AccountGetPayload<{ include: typeof accountReadInclude }>) =>
            accountTableItemSchema.parse(publicAccount(row)),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}

/** Expose only the protected account table read. */
@ApiTags('Ledger')
@Controller('accounts')
class AccountTableController {
  /** Receive the account table reader for the application's database. */
  constructor(@Inject(AccountTableService) private readonly table: AccountTableService) {}

  /** Query public account summaries. */
  @Get('table')
  query(@Query() raw: unknown) {
    return this.table.query(raw);
  }
}

/** Own the account table independently from account editing and balance history. */
@Module({ controllers: [AccountTableController], providers: [AccountTableService] })
export class AccountTableModule {
  /** Register the isolated database instance selected by the application. */
  static register(db: Db): DynamicModule {
    return { module: AccountTableModule, providers: [{ provide: 'DB', useValue: db }] };
  }
}
