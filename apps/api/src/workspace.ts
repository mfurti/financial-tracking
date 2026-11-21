import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import { AppError } from './errors.js';

/** Own current-owner display metadata without modifying authentication or financial identities. */
@Injectable()
export class WorkspaceService {
  /** Use only application-owned persistence; profile contact data never enters logs or bank adapters. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Resolve the authenticated singleton username, never an owner ID supplied by the client. */
  private async owner(username: string | undefined) {
    if (!username) throw new AppError('UNAUTHENTICATED', 'Bitte anmelden.', 401);
    const user = await this.db.user.findUnique({ where: { username }, include: { profile: true } });
    if (!user || user.singleton !== 1) throw new AppError('UNAUTHENTICATED', 'Bitte anmelden.', 401);
    return user;
  }

  /** Read saved metadata or a truthful unpersisted owner-name fallback without a write on GET. */
  async profile(username: string | undefined) {
    const user = await this.owner(username);
    const fallback = user.username.trim();
    return c.workspaceProfileSchema.parse({
      userId: user.id,
      displayName: user.profile?.displayName ?? (fallback && fallback.length <= 80 ? fallback : 'Eigentümer'),
      contactEmail: user.profile?.contactEmail ?? null,
      updatedAt: user.profile?.updatedAt.toISOString() ?? null,
    });
  }

  /** Save independent contact/display fields; omitted contact email preserves the current value. */
  async saveProfile(username: string | undefined, raw: z.infer<typeof c.workspaceProfileInputSchema>) {
    const input = c.workspaceProfileInputSchema.parse(raw);
    const user = await this.owner(username);
    const profile = await this.db.ownerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, displayName: input.displayName, contactEmail: input.contactEmail ?? null },
      update: {
        displayName: input.displayName,
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      },
    });
    return c.workspaceProfileSchema.parse({ ...profile, updatedAt: profile.updatedAt.toISOString() });
  }
}
