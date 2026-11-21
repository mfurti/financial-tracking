import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AuthGuard, AuthService } from './auth.js';
import { RootController } from './controller.js';
import { createDb, type Db } from './db.js';
import { SafeErrors } from './errors.js';
import { ImportController } from './import-controller.js';
import { ImportService } from './imports.js';
import { LedgerController } from './ledger-controller.js';
import { LedgerService } from './ledger.js';
import { SyncService } from './sync.js';
import { startBank } from './bank.js';
import { completeApiDocument } from './api-document.js';
import { ContractInterceptor } from './contract-interceptor.js';
import { AssignmentController } from './assignment-controller.js';
import { AssignmentService } from './assignments.js';
import { CategoryRulesController } from './category-rules-controller.js';
import { CategoryRulesService } from './category-rules.js';
import { ContractsController } from './contracts-controller.js';
import { ContractsService } from './contracts.js';
import { AnalyticsService } from './analytics.js';
import { ImportRollbackService } from './import-rollback.js';
import { ReservesService } from './reserves.js';
import { WorkspaceController } from './workspace-controller.js';
import { WealthService } from './wealth.js';
import { WorkspaceService } from './workspace.js';
import { AccountGroupsService } from './account-groups.js';
import { NotificationsService } from './notifications.js';

/** Create an application with injectable persistence for integration tests. */
export async function createApp(
  db: Db = createDb(),
  recover = true,
): Promise<{ app: NestFastifyApplication; db: Db; openapi: OpenAPIObject }> {
  @Module({
    controllers: [
      RootController,
      ImportController,
      LedgerController,
      AssignmentController,
      CategoryRulesController,
      ContractsController,
      WorkspaceController,
    ],
    providers: [
      { provide: 'DB', useValue: db },
      AuthService,
      ImportService,
      ImportRollbackService,
      LedgerService,
      SyncService,
      AssignmentService,
      CategoryRulesService,
      ContractsService,
      ReservesService,
      WealthService,
      WorkspaceService,
      AccountGroupsService,
      NotificationsService,
      AnalyticsService,
      { provide: 'BANK_FACTORY', useValue: startBank },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 15 * 1024 * 1024, logger: false }),
    { logger: false },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new SafeErrors());
  app.useGlobalInterceptors(new ContractInterceptor());
  app
    .getHttpAdapter()
    .getInstance()
    .addHook(
      'onSend',
      /** Apply headers to successes and errors without body inspection. */ async (
        _request: unknown,
        reply: { header: (name: string, value: string) => void },
        payload: unknown,
      ) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('Referrer-Policy', 'no-referrer');
        reply.header('Cache-Control', 'no-store');
        return payload;
      },
    );
  await app.init();
  if (recover) await app.get(SyncService).recover();
  const openapi = cleanupOpenApiDoc(
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Household ledger').setVersion('1').addCookieAuth('ledger_session').build(),
    ),
  );
  // The document is generated for validation/export; no unauthenticated Swagger route is exposed.
  return { app, db, openapi: completeApiDocument(openapi) };
}
