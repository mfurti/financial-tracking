import { Module, type DynamicModule } from '@nestjs/common';
import type { Db } from '../../db.js';
import { TransactionTableController } from './transaction-table.controller.js';
import { TransactionTableService } from './transaction-table.service.js';

/** Own the transaction table adapter without moving existing transaction commands. */
@Module({ controllers: [TransactionTableController], providers: [TransactionTableService] })
export class TransactionTableModule {
  /** Share the calling application's persistence, including disposable databases in tests. */
  static register(db: Db): DynamicModule {
    return { module: TransactionTableModule, providers: [{ provide: 'DB', useValue: db }] };
  }
}
