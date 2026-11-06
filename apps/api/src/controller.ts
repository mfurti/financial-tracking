import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { loginSchema, sessionSchema, passwordChangeSchema } from '@financial-tracking/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.js';

/** Login contract adapter; shared fields are defined only in contracts. */
class LoginDto extends createZodDto(loginSchema) {}
/** Public authenticated session contract. */
class SessionDto extends createZodDto(sessionSchema) {}

/** Authentication routes and a minimal process liveness probe. */
@Controller()
export class RootController {
  /** Receive session management without implicit reflection dependencies. */
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Liveness only; does not disclose environment or financial data. */
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Authenticate and return the shared session transport. */
  @Post('auth/login')
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: SessionDto })
  async login(@Body() body: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const input = loginSchema.parse(body);
    return sessionSchema.parse(await this.auth.login(input.username, input.password, req, reply));
  }

  /** Recover CSRF/session details after reloading the browser. */
  @Get('auth/session')
  @ApiOkResponse({ type: SessionDto })
  session(@Req() req: FastifyRequest) {
    return sessionSchema.parse(req.authSession);
  }

  /** Revoke server-side session before the browser cookie is removed. */
  @Post('auth/password')
  async password(@Body() body: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const input = passwordChangeSchema.parse(body);
    await this.auth.changePassword(req, reply, input.currentPassword, input.newPassword);
    return { ok: true };
  }

  /** Revoke server-side session before the browser cookie is removed. */
  @Post('auth/logout')
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(req, reply);
    return { ok: true };
  }
}
