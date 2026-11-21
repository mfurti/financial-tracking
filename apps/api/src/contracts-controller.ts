import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { ContractsService } from './contracts.js';
/** Private contract transport with the shared Zod runtime/API inventory. */
@Controller()
export class ContractsController {
  /** Inject persistence-backed contract behavior. */
  constructor(@Inject(ContractsService) private readonly service: ContractsService) {}
  /** List current obligations in next-due order. */
  @Get('contracts') list() {
    return this.service.list();
  }
  /** Read suggestions without accepting them. */
  @Get('contracts/suggestions') suggestions(@Query() query: unknown) {
    return this.service.suggestions(c.suggestionQuerySchema.parse(query).dismissed === 'true');
  }
  /** Persist an explicit rejection, never interpreting a swipe as consent. */
  @Put('contracts/suggestions/:key/decision') dismiss(@Param('key') key: string, @Body() body: unknown) {
    c.suggestionDecisionSchema.parse(body);
    return this.service.decide(c.suggestionKeySchema.parse(key), true);
  }
  /** Restore a previously rejected pattern without creating a contract. */
  @Delete('contracts/suggestions/:key/decision') restore(@Param('key') key: string) {
    return this.service.decide(c.suggestionKeySchema.parse(key), false);
  }
  /** Read rounded monthly planning totals before the dynamic contract-ID route. */
  @Get('contracts/summary') summary(@Query() query: unknown) {
    return this.service.summary(undefined, c.accountScopeQuerySchema.parse(query));
  }
  /** Read bounded recurrence-derived plans and separately observed payments before the dynamic ID route. */
  @Get('contracts/calendar') calendar(@Query() query: unknown) {
    return this.service.calendar(c.contractCalendarQuerySchema.parse(query));
  }
  /** Confirm a contract explicitly. */
  @Post('contracts') create(@Body() body: unknown) {
    return this.service.create(c.contractInputSchema.parse(body));
  }
  /** Read a contract summary and historical rules. */
  @Get('contracts/:id') get(@Param('id') id: string) {
    return this.service.get(c.idSchema.parse(id));
  }
  /** Edit descriptive metadata and inclusive term. */
  @Patch('contracts/:id') patch(@Param('id') id: string, @Body() body: unknown) {
    return this.service.patch(c.idSchema.parse(id), c.contractPatchSchema.parse(body));
  }
  /** Remove only the contract and its links. */
  @Delete('contracts/:id') remove(@Param('id') id: string, @Body() body: unknown) {
    z.object({ confirm: z.literal(true) }).parse(body);
    return this.service.remove(c.idSchema.parse(id));
  }
  /** Add a future effective payment rule. */
  @Post('contracts/:id/revisions') revise(@Param('id') id: string, @Body() body: unknown) {
    return this.service.revise(c.idSchema.parse(id), c.contractRevisionInputSchema.parse(body));
  }
  /** Read calendar history and actual links. */
  @Get('contracts/:id/payments') payments(@Param('id') id: string, @Query() query: unknown) {
    return this.service.payments(c.idSchema.parse(id), c.contractPaymentsQuerySchema.parse(query));
  }
  /** Attribute an actual payment with explicit deviation consent where required. */
  @Post('contracts/:id/payments') link(@Param('id') id: string, @Body() body: unknown) {
    return this.service.link(c.idSchema.parse(id), c.contractPaymentInputSchema.parse(body));
  }
  /** Preserve the booking and block immediate automatic relinking. */
  @Delete('contracts/:id/payments/:paymentId') unlink(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.service.unlink(c.idSchema.parse(id), c.idSchema.parse(paymentId));
  }
}
