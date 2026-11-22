import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { tablePageQuerySchema } from '@financial-tracking/contracts';
import { TransactionTableService } from './transaction-table.service.js';

/** Protected paginated transaction collection beside the legacy cursor route. */
@ApiTags('Ledger')
@Controller('transactions')
export class TransactionTableController {
  /** Receive the bounded table query implementation. */
  constructor(@Inject(TransactionTableService) private readonly table: TransactionTableService) {}

  /** Validate the public query envelope before any resource lookup. */
  @Get('table')
  query(@Query() query: unknown) {
    return this.table.query(tablePageQuerySchema.parse(query));
  }
}
