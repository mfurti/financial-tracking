import { Body, Controller, Inject, Post } from '@nestjs/common';
import { assignmentInputSchema, assignmentPreviewInputSchema } from '@financial-tracking/contracts';
import { AssignmentService } from './assignments.js';

/** Explicit account-assignment endpoints share the application authentication and CSRF guard. */
@Controller('transactions')
export class AssignmentController {
  /** Bind only the transaction reconciliation owner. */
  constructor(@Inject(AssignmentService) private readonly assignments: AssignmentService) {}
  /** Offer current candidates without changing any source transaction. */
  @Post('assignment-preview')
  preview(@Body() input: unknown) {
    return this.assignments.preview(assignmentPreviewInputSchema.parse(input));
  }
  /** Apply a user-reviewed, version-bound and replay-safe assignment batch. */
  @Post('assign')
  assign(@Body() input: unknown) {
    return this.assignments.apply(assignmentInputSchema.parse(input));
  }
}
