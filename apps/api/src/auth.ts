import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { verify, hash, argon2id } from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Session } from '@financial-tracking/contracts';
import { type Db } from './db.js';
import { AppError } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    authSession?: Session;
    sessionHash?: string;
  }
}

/** Hash opaque session tokens before persistence. */
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Password policy for administrative creation and reauthentication. */
export async function passwordHash(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new AppError('PASSWORD_POLICY', 'Passwort muss 12 bis 256 Zeichen enthalten.');
  return hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

/** Authentication lifecycle for the single private user. */
@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private dummyHash?: Promise<string>;

  /** Receive the application database through a stable DI token. */
  constructor(@Inject('DB') private readonly db: Db) {}

  /** Validate same-origin requests, including login before a session exists. */
  checkOrigin(req: FastifyRequest) {
    const origin = req.headers.origin;
    const expected = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    if (origin !== new URL(expected).origin) throw new AppError('INVALID_ORIGIN', 'Anfrage nicht zulässig.', 403);
  }

  /** Bound brute-force attempts by both IP and username. */
  private throttle(key: string) {
    const now = Date.now();
    for (const [entryKey, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(entryKey);
    if (this.attempts.size >= 10000 && !this.attempts.has(key))
      throw new AppError('LOGIN_RATE_LIMIT', 'Bitte später erneut versuchen.', 429);
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    entry.count += 1;
    this.attempts.set(key, entry);
    if (entry.count > 10) throw new AppError('LOGIN_RATE_LIMIT', 'Bitte später erneut versuchen.', 429);
  }

  /** Replace any old session and return a session-bound CSRF token. */
  async login(username: string, password: string, req: FastifyRequest, reply: FastifyReply) {
    this.checkOrigin(req);
    this.throttle(`ip:${req.ip}`);
    this.throttle(`user:${username.toLowerCase()}`);
    const user = await this.db.user.findUnique({ where: { username } });
    this.dummyHash ??= passwordHash(randomBytes(32).toString('hex'));
    const valid = await verify(user?.passwordHash ?? (await this.dummyHash), password);
    if (!valid || !user) throw new AppError('INVALID_LOGIN', 'Benutzername oder Passwort ungültig.', 401);
    const previous = this.cookieToken(req);
    if (previous) await this.db.session.deleteMany({ where: { tokenHash: tokenHash(previous) } });
    await this.db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400_000);
    const session = await this.db.session.create({
      data: { userId: user.id, tokenHash: tokenHash(token), csrfToken: randomBytes(32).toString('hex'), expiresAt },
    });
    reply.header('set-cookie', this.cookie(token, 7 * 86400));
    return { username, csrfToken: session.csrfToken, expiresAt: expiresAt.toISOString() };
  }

  /** Read only the expected fixed-size opaque cookie. */
  private cookieToken(req: FastifyRequest) {
    return /(?:^|;\s*)ledger_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
  }

  /** Use Secure cookies in production; HTTP development is explicit. */
  private cookie(token: string, maxAge: number) {
    return `ledger_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  }

  /** Reject expired sessions and verify CSRF on every authenticated write. */
  async authenticate(req: FastifyRequest) {
    const token = this.cookieToken(req);
    if (!token) throw new AppError('UNAUTHENTICATED', 'Bitte anmelden.', 401);
    const key = tokenHash(token);
    const session = await this.db.session.findUnique({ where: { tokenHash: key }, include: { user: true } });
    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      session.lastSeenAt.getTime() < Date.now() - 12 * 3600_000
    ) {
      if (session) await this.db.session.deleteMany({ where: { tokenHash: key } });
      throw new AppError('SESSION_EXPIRED', 'Sitzung abgelaufen. Bitte erneut anmelden.', 401);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      this.checkOrigin(req);
      const csrf = req.headers['x-csrf-token'];
      if (
        typeof csrf !== 'string' ||
        csrf.length !== session.csrfToken.length ||
        !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrfToken))
      )
        throw new AppError('CSRF_INVALID', 'Sicherheitsprüfung fehlgeschlagen.', 403);
    }
    await this.db.session.update({ where: { tokenHash: key }, data: { lastSeenAt: new Date() } });
    req.sessionHash = key;
    req.authSession = {
      username: session.user.username,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /** Invalidate the persisted token and remove the cookie. */
  async logout(req: FastifyRequest, reply: FastifyReply) {
    await this.db.session.deleteMany({ where: { tokenHash: req.sessionHash } });
    reply.header('set-cookie', this.cookie('', 0));
  }
}

/** Apply authentication uniformly to every financial endpoint. */
@Injectable()
export class AuthGuard implements CanActivate {
  /** Bind the authentication service explicitly for tsx and compiled runtime parity. */
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  /** Login and health are the only unprotected controller actions. */
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const pathname = req.url.split('?')[0];
    if (pathname === '/api/v1/health' || (pathname === '/api/v1/auth/login' && req.method === 'POST')) return true;
    await this.auth.authenticate(req);
    return true;
  }
}
