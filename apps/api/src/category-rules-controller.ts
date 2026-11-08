import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import * as c from '@financial-tracking/contracts';
import { CategoryRulesService } from './category-rules.js';

/** Authenticated literal-rule transport; shared schemas own all request/response shapes. */
@Controller()
export class CategoryRulesController {
  /** Receive the rule service from the application's container. */
  constructor(@Inject(CategoryRulesService) private readonly service: CategoryRulesService) {}
  /** List rules and their evaluation order. */
  @Get('category-rules') list() {
    return this.service.list();
  }
  /** Create a future-import rule. */
  @Post('category-rules') create(@Body() body: unknown) {
    return this.service.save(c.categoryRuleInputSchema.parse(body));
  }
  /** Edit or disable without modifying historical annotations. */
  @Patch('category-rules/:id') patch(@Param('id') id: string, @Body() body: unknown) {
    return this.service.save(c.categoryRulePatchSchema.parse(body), c.idSchema.parse(id));
  }
  /** Remove only the rule. */
  @Delete('category-rules/:id') remove(@Param('id') id: string) {
    return this.service.remove(c.idSchema.parse(id));
  }
  /** Explicitly recategorize existing non-manual rows. */
  @Post('category-rules/apply') apply(@Body() body: unknown) {
    c.categoryRuleBackfillSchema.parse(body);
    return this.service.apply();
  }
  /** Install selected templates without renaming existing categories. */
  @Post('categories/templates') templates(@Body() body: unknown) {
    return this.service.templates(c.categoryTemplateInputSchema.parse(body).names);
  }
}
