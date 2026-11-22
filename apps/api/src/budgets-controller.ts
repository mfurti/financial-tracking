import { Body, Controller, Delete, Get, Inject, Param, Put, Query } from '@nestjs/common';
import * as c from '@financial-tracking/contracts';
import { BudgetsService } from './budgets.js';

/** Manage workspace-wide category limits under the private session and CSRF guard. */
@Controller('budgets')
export class BudgetsController {
  constructor(@Inject(BudgetsService) private readonly budgets: BudgetsService) {}

  @Get() list(@Query() query: unknown) {
    return this.budgets.list(c.categoryBudgetQuerySchema.parse(query).month);
  }

  @Put() set(@Body() body: unknown) {
    return this.budgets.set(c.categoryBudgetInputSchema.parse(body));
  }

  @Delete(':id') remove(@Param('id') id: string, @Body() body: unknown) {
    c.categoryBudgetDeleteSchema.parse(body);
    return this.budgets.remove(c.idSchema.parse(id));
  }
}
