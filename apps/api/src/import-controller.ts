import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { csvPreviewInputSchema, csvPreviewSchema, idSchema, runSchema } from '@financial-tracking/contracts';
import { ImportService } from './imports.js';
import { SyncService } from './sync.js';
import { bankSetup } from './bank.js';
import { ImportRollbackService } from './import-rollback.js';
import { rollbackInputSchema } from '@financial-tracking/contracts';
import {
  csvCommitSchema,
  resolutionSchema,
  syncInputSchema,
  challengeInputSchema,
} from '@financial-tracking/contracts';

/** Shared CSV request adapter. */
class PreviewInputDto extends createZodDto(csvPreviewInputSchema) {}
/** Shared CSV response adapter. */
class PreviewDto extends createZodDto(csvPreviewSchema) {}
/** Shared status response adapter. */
class RunDto extends createZodDto(runSchema) {}

/** CSV preview and import status routes. */
@Controller()
export class ImportController {
  /** Expose only safe setup requirements to the authenticated application. */
  @Get('bank-setup')
  setup() {
    return bankSetup();
  }
  /** Receive durable import state management. */
  constructor(
    @Inject(ImportService) private readonly imports: ImportService,
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(ImportRollbackService) private readonly rollbackService: ImportRollbackService,
  ) {}
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
    return this.sync.status(idSchema.parse(id));
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
    return this.sync.cancel(idSchema.parse(id));
  }
  /** Confirm a preview, with explicit partial-import consent. */
  @Post('imports/csv/:id/commit')
  commit(@Param('id') id: string, @Body() body: unknown) {
    return this.imports.commit(idSchema.parse(id), csvCommitSchema.parse(body).allowPartial);
  }
  /** Resolve staged duplicate candidates. */
  @Post('imports/:id/resolutions')
  resolve(@Param('id') id: string, @Body() body: unknown) {
    return this.imports.resolve(idSchema.parse(id), resolutionSchema.parse(body).resolutions);
  }
  /** Start a single manual bank refresh. */
  @Post('bank-connections/:id/sync')
  @HttpCode(202)
  start(@Param('id') id: string, @Body() body: unknown) {
    return this.sync.start(idSchema.parse(id), syncInputSchema.parse(body));
  }
  /** Submit a transient TAN or app approval confirmation. */
  @Post('import-runs/:id/challenge')
  challenge(@Param('id') id: string, @Body() body: unknown) {
    return this.sync.challenge(idSchema.parse(id), challengeInputSchema.parse(body));
  }
  /** Show bounded import history without bank secrets. */
  @Get('imports')
  history() {
    return this.sync.history();
  }
  /** Preview the protected rows and links before an authenticated destructive action. */
  @Get('imports/:id/rollback-preview')
  rollbackPreview(@Param('id') id: string) {
    return this.rollbackService.preview(idSchema.parse(id));
  }
  /** Apply only an explicitly confirmed, still-current CSV rollback. */
  @Post('imports/:id/rollback')
  rollback(@Param('id') id: string, @Body() body: unknown) {
    return this.rollbackService.rollback(idSchema.parse(id), rollbackInputSchema.parse(body));
  }
}
