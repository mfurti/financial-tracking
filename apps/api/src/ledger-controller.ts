import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { LedgerService } from './ledger.js';
import { AnalyticsService } from './analytics.js';

/** Connection configuration transport adapter. */
class ConnectionInput extends createZodDto(c.connectionInputSchema) {}
/** Account creation transport adapter. */
class AccountInput extends createZodDto(c.accountInputSchema) {}
/** Category creation transport adapter. */
class CategoryInput extends createZodDto(c.categoryInputSchema) {}
/** Transaction page response adapter. */
class TransactionPage extends createZodDto(c.transactionPageSchema) {}
/** Monthly report response adapter. */
class Monthly extends createZodDto(c.monthlySchema) {}

/** Ledger endpoints delegate financial rules to one service. */
@Controller()
export class LedgerController {
  /** Inject ledger management explicitly. */
  constructor(
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}
  /** Read exact inclusive multi-month actuals and disclosed average denominators. */
  @Get('analytics/overview') overview(@Query() query: unknown) {
    return this.analytics.overview(c.analyticsOverviewQuerySchema.parse(query));
  }
  /** Read reconcilable merchant buckets with the same effective account/category/date scope as their details. */
  @Get('analytics/merchants') merchants(@Query() query: unknown) {
    return this.analytics.merchants(c.merchantAnalyticsQuerySchema.parse(query));
  }
  /** Read exact selected-month actuals, honest completeness metadata and reconcilable direction queries. */
  @Get('analytics/review') review(@Query() query: unknown) {
    return this.analytics.review(c.monthlyReviewQuerySchema.parse(query));
  }
  /** List bank connections. */
  @Get('bank-connections') connections() {
    return this.ledger.connections();
  }
  /** Create a bank/CSV connection. */
  @Post('bank-connections') @ApiBody({ type: ConnectionInput }) createConnection(@Body() body: unknown) {
    return this.ledger.createConnection(c.connectionInputSchema.parse(body));
  }
  /** Change connection settings without accepting a bank URL. */
  @Patch('bank-connections/:id') patchConnection(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.patchConnection(
      c.idSchema.parse(id),
      c.connectionInputSchema
        .partial()
        .extend({ status: z.enum(['ACTIVE', 'DISABLED', 'BLOCKED']).optional() })
        .parse(body),
    );
  }
  /** List accounts. */
  @Get('accounts') accounts() {
    return this.ledger.accounts();
  }
  /** Create a manual CSV account. */
  @Post('accounts') @ApiBody({ type: AccountInput }) createAccount(@Body() body: unknown) {
    return this.ledger.createAccount(c.accountInputSchema.parse(body));
  }
  /** Read one account. */
  @Get('accounts/:id') account(@Param('id') id: string) {
    return this.ledger.account(c.idSchema.parse(id));
  }
  /** Edit account display settings. */
  @Patch('accounts/:id') patchAccount(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.patchAccount(c.idSchema.parse(id), c.accountPatchSchema.parse(body));
  }
  /** Read actual observed balance history. */
  @Get('accounts/:id/balances') balances(@Param('id') id: string) {
    return this.ledger.balances(c.idSchema.parse(id));
  }
  /** List bounded filtered transactions. */
  @Get('transactions') @ApiOkResponse({ type: TransactionPage }) transactions(@Query() query: unknown) {
    return this.ledger.transactions(c.transactionQuerySchema.parse(query));
  }
  /** Read one transaction. */
  @Get('transactions/:id') transaction(@Param('id') id: string) {
    return this.ledger.transaction(c.idSchema.parse(id));
  }
  /** Change only user-owned annotations. */
  @Patch('transactions/:id') patchTransaction(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.patchTransaction(c.idSchema.parse(id), c.transactionPatchSchema.parse(body));
  }
  /** Assign a category to selected transactions. */
  @Post('transactions/bulk-category') bulk(@Body() body: unknown) {
    const input = c.bulkCategorySchema.parse(body);
    return this.ledger.bulkCategory(input.ids, input.categoryId);
  }
  /** List active and historical categories. */
  @Post('transactions/bulk-classification') classification(@Body() body: unknown) {
    const input = c.bulkClassificationSchema.parse(body);
    return this.ledger.bulkClassification(input.ids, input.classification);
  }
  /** List active and historical categories. */
  @Get('categories') categories() {
    return this.ledger.categories();
  }
  /** Create a category. */
  @Post('categories') @ApiBody({ type: CategoryInput }) createCategory(@Body() body: unknown) {
    return this.ledger.createCategory(c.categoryInputSchema.parse(body));
  }
  /** Edit or disable a category. */
  @Patch('categories/:id') patchCategory(@Param('id') id: string, @Body() body: unknown) {
    return this.ledger.patchCategory(c.idSchema.parse(id), c.categoryInputSchema.partial().parse(body));
  }
  /** Delete only after explicit confirmation. */
  @Delete('categories/:id') deleteCategory(@Param('id') id: string, @Body() body: unknown) {
    z.object({ confirm: z.literal(true) }).parse(body);
    return this.ledger.deleteCategory(c.idSchema.parse(id));
  }
  /** Produce an exact monthly report. */
  @Get('analytics/monthly') @ApiOkResponse({ type: Monthly }) monthly(@Query() query: unknown) {
    const input = c.monthlyQuerySchema.parse(query);
    return this.ledger.monthly(input.month, input.accountId, input.groupId);
  }
  /** Link transfer sides. */
  @Post('transfers') transfer(@Body() body: unknown) {
    return this.ledger.createTransfer(c.transferSchema.parse(body));
  }
  /** Undo a transfer classification. */
  @Delete('transfers/:id') removeTransfer(@Param('id') id: string) {
    return this.ledger.removeTransfer(c.idSchema.parse(id));
  }
}
