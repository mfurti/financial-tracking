import { Controller, Get, Inject, Injectable, Module, Query, type DynamicModule } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceQuery, type FieldSchema } from '@querry-kit/nest/core';
import {
  contractTableFilterSchema,
  contractTableItemSchema,
  contractTableOrderSchema,
  tablePageQuerySchema,
} from '@financial-tracking/contracts';
import type { Db } from '../../db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { contractDetails, publicContract } from '../../contracts.js';
import { berlinToday } from '../../contract-schedule.js';
import { resolveAccountScope } from '../../account-scope.js';
import { ScopedTableQuery, tableFields, tableJson } from '../../resource-table.js';

const fields: FieldSchema = Object.fromEntries(
  Object.keys(contractTableItemSchema.shape).map(
    /** Publish mapped list fields without underlying payment rows. */ (name) => [name, true],
  ),
);

/** Resolve paginated contract plans through the existing recurrence model. */
@Injectable()
class ContractTableService {
  /** Use the database owned by the Nest application. */
  constructor(@Inject('DB') private readonly db: Db) {}

  /** Enforce scope, stable ordering and one business date per page. */
  query(raw: unknown) {
    const query = tablePageQuerySchema.parse(raw);
    const filter = tableJson(query.where, contractTableFilterSchema, {});
    const sort = tableJson(query.orderBy, contractTableOrderSchema, [{ name: 'asc' }]);
    const projection = tableFields(query.fields, fields);
    const today = berlinToday();
    return this.db.$transaction(
      /** Read only matching contracts and keep calculated dues separate from posted payments. */ async (tx) => {
        const where: Prisma.ContractWhereInput = {
          accountId: await resolveAccountScope(tx, filter),
          direction: filter.direction,
          OR: filter.search
            ? [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { provider: { contains: filter.search, mode: 'insensitive' } },
              ]
            : undefined,
        };
        return ResourceQuery.query({
          service: new ScopedTableQuery<Prisma.ContractDelegate>(tx.contract, where),
          query: { page: query.page, perPage: query.perPage, fields: projection, orderBy: [...sort, { id: 'desc' }] },
          schema: fields,
          include: contractDetails,
          /** Derive the same effective forecast used by the legacy contract detail. */
          map: (row: Prisma.ContractGetPayload<{ include: typeof contractDetails }>) =>
            contractTableItemSchema.parse(publicContract(row, today)),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}

/** Bind the paginated list alongside legacy payment and calendar routes. */
@ApiTags('Contracts')
@Controller('contracts')
class ContractTableController {
  /** Receive the contract table reader. */
  constructor(@Inject(ContractTableService) private readonly table: ContractTableService) {}

  /** Read the public contract page. */
  @Get('table')
  query(@Query() raw: unknown) {
    return this.table.query(raw);
  }
}

/** Register the read adapter without altering contract commands. */
@Module({ controllers: [ContractTableController], providers: [ContractTableService] })
export class ContractTableModule {
  /** Share the caller's existing application database. */
  static register(db: Db): DynamicModule {
    return { module: ContractTableModule, providers: [{ provide: 'DB', useValue: db }] };
  }
}
