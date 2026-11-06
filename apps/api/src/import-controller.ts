import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { csvPreviewInputSchema, csvPreviewSchema, idSchema, runSchema } from '@financial-tracking/contracts';
import { ImportService } from './imports.js';

/** Shared CSV request adapter. */
class PreviewInputDto extends createZodDto(csvPreviewInputSchema) {}
/** Shared CSV response adapter. */
class PreviewDto extends createZodDto(csvPreviewSchema) {}
/** Shared status response adapter. */
class RunDto extends createZodDto(runSchema) {}

/** CSV preview and import status routes. */
@Controller()
export class ImportController {
  /** Receive durable import state management. */
  constructor(@Inject(ImportService) private readonly imports: ImportService) {}
  /** Stage a CSV preview. */
  @Post('imports/csv/preview')
  @ApiBody({ type: PreviewInputDto })
  @ApiOkResponse({ type: PreviewDto })
  preview(@Body() body: unknown) {
    return this.imports.preview(csvPreviewInputSchema.parse(body));
  }
  /** Read import status. */
  @Get('import-runs/:id')
  @ApiOkResponse({ type: RunDto })
  run(@Param('id') id: string) {
    return this.imports.run(idSchema.parse(id));
  }
  /** List unresolved diagnostics. */
  @Get('imports/:id/issues')
  issues(@Param('id') id: string) {
    return this.imports.issues(idSchema.parse(id));
  }
  /** Cancel an uncommitted preview. */
  @Post('import-runs/:id/cancel')
  @ApiOkResponse({ type: RunDto })
  cancel(@Param('id') id: string) {
    return this.imports.cancel(idSchema.parse(id));
  }
}
