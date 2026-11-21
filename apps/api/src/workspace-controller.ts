import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import * as c from '@financial-tracking/contracts';
import { ReservesService } from './reserves.js';
import { WealthService } from './wealth.js';
import { WorkspaceService } from './workspace.js';
import { AccountGroupsService } from './account-groups.js';
import { NotificationsService } from './notifications.js';

/** Private singleton workspace metadata using the existing session/CSRF and shared runtime contracts. */
@Controller()
export class WorkspaceController {
  /** Inject only delivered workspace services; real financial sources stay owned by their existing services. */
  constructor(
    @Inject(ReservesService) private readonly reserves: ReservesService,
    @Inject(WealthService) private readonly wealth: WealthService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(AccountGroupsService) private readonly groups: AccountGroupsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}
  /** Read derived private in-app events and their independent acknowledgement state. */
  @Get('notifications') notificationList(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.notifications.list(request.authSession?.username, c.notificationsQuerySchema.parse(query));
  }
  /** Acknowledge only an actual source identity, never a financial record or another owner. */
  @Put('notifications/acknowledgement') acknowledgeNotification(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.notifications.acknowledge(
      request.authSession?.username,
      c.notificationAcknowledgementInputSchema.parse(body),
    );
  }
  /** List durable account membership groups without financial aggregation. */
  @Get('account-groups') accountGroups() {
    return this.groups.list();
  }
  /** Create one atomic metadata/membership set. */
  @Post('account-groups') createGroup(@Body() body: unknown) {
    return this.groups.create(c.accountGroupInputSchema.parse(body));
  }
  /** Update only explicitly supplied group fields. */
  @Patch('account-groups/:id') patchGroup(@Param('id') id: string, @Body() body: unknown) {
    return this.groups.patch(c.idSchema.parse(id), c.accountGroupPatchSchema.parse(body));
  }
  /** Require explicit confirmation before removing only the group metadata. */
  @Delete('account-groups/:id') deleteGroup(@Param('id') id: string, @Body() body: unknown) {
    c.accountGroupDeleteSchema.parse(body);
    return this.groups.remove(c.idSchema.parse(id));
  }
  /** Read only the authenticated current owner's display/contact metadata. */
  @Get('workspace/profile') profile(@Req() request: FastifyRequest) {
    return this.workspace.profile(request.authSession?.username);
  }
  /** Save independent metadata through the existing authenticated CSRF boundary. */
  @Patch('workspace/profile') saveProfile(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.workspace.saveProfile(request.authSession?.username, c.workspaceProfileInputSchema.parse(body));
  }
  /** Read immutable recorded history separately from a live source preview. */
  @Get('wealth-records') wealthRecords(@Query() query: unknown) {
    return this.wealth.list(c.wealthRecordsQuerySchema.parse(query));
  }
  /** Explicitly capture only server-derived values using the caller's bounded retry identity. */
  @Post('wealth-records') captureWealth(@Body() body: unknown) {
    return this.wealth.capture(c.wealthRecordInputSchema.parse(body));
  }
  /** Read explicit reserve settings and dated source observations. */
  @Get('reserve-goal') reserve() {
    return this.reserves.goal();
  }
  /** Save the positive target without accepting a current balance from the client. */
  @Put('reserve-goal') setReserve(@Body() body: unknown) {
    return this.reserves.setGoal(c.reserveGoalInputSchema.parse(body));
  }
  /** Save an independent Tagesgeld designation without rewriting account or imported fields. */
  @Patch('accounts/:id/presentation') presentation(@Param('id') id: string, @Body() body: unknown) {
    return this.reserves.setPresentation(c.idSchema.parse(id), c.accountPresentationInputSchema.parse(body));
  }
}
