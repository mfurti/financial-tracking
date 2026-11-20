import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Serialize the exact row snapshot returned inside the mutation's transaction. */
function publicGroup(group: Prisma.AccountGroupGetPayload<{ include: { members: true } }>) {
  return c.accountGroupSchema.parse({
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
    accountIds: group.members
      .map(/** Publish each unique persisted account reference. */ (member) => member.accountId)
      .sort(),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  });
}

/** Manage singleton-workspace membership metadata without copying or modifying account money. */
@Injectable()
export class AccountGroupsService {
  /** Reuse the existing owner workspace database and authentication boundary. */
  constructor(@Inject('DB') readonly db: Db) {}
  /** Return stable group order and unique member IDs, including inactive historical accounts. */
  async list() {
    const groups = await this.db.accountGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      include: { members: { orderBy: { accountId: 'asc' } } },
    });
    return groups.map(
      /** Publish only contract metadata, never ORM relationship internals. */ (group) => {
        // Resolve the one membership identity.
        return publicGroup(group);
      },
    );
  }
  /** Serialize name validation so Unicode case variants cannot race around database collation differences. */
  private async validate(tx: Prisma.TransactionClient, input: { name?: string; accountIds?: string[] }, id?: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(783013, 38)::text`;
    if (input.name) {
      const groups = await tx.accountGroup.findMany({ select: { id: true, name: true } });
      if (
        groups.some(
          /** Compare trimmed Unicode names inside the shared mutation lock. */ (group) =>
            group.id !== id && group.name.toLocaleLowerCase('de-DE') === input.name!.toLocaleLowerCase('de-DE'),
        )
      )
        throw new AppError('GROUP_NAME_EXISTS', 'Eine Kontogruppe mit diesem Namen existiert bereits.', 409);
    }
    if (
      input.accountIds &&
      (await tx.account.count({ where: { id: { in: input.accountIds } } })) !== input.accountIds.length
    )
      throw new AppError('ACCOUNT_NOT_FOUND', 'Mindestens ein ausgewähltes Konto ist nicht mehr verfügbar.', 404);
  }
  /** Validate all references then create metadata and memberships in a single transaction. */
  async create(raw: z.infer<typeof c.accountGroupInputSchema>) {
    const input = c.accountGroupInputSchema.parse(raw);
    // Return the newly committed public identity.
    return this.db.$transaction(
      /** No rejected group may leave partial memberships behind. */ async (tx) => {
        await this.validate(tx, input);
        return publicGroup(
          await tx.accountGroup.create({
            include: { members: true },
            data: {
              name: input.name,
              sortOrder: input.sortOrder,
              members: {
                create: input.accountIds.map(
                  /** Insert each already-deduplicated owned reference once. */ (accountId) => ({ accountId }),
                ),
              },
            },
          }),
        );
      },
    );
  }
  /** Replace only supplied fields/memberships atomically; absent arrays never erase a group. */
  async patch(id: string, raw: z.infer<typeof c.accountGroupPatchSchema>) {
    const input = c.accountGroupPatchSchema.parse(raw);
    // Return the saved public identity after the atomic commit.
    return this.db.$transaction(
      /** Validate before replacing a membership set. */ async (tx) => {
        await this.validate(tx, input, id);
        if (!(await tx.accountGroup.findUnique({ where: { id } })))
          throw new AppError('GROUP_NOT_FOUND', 'Kontogruppe nicht gefunden.', 404);
        return publicGroup(
          await tx.accountGroup.update({
            include: { members: true },
            where: { id },
            data: {
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
              ...(input.accountIds !== undefined
                ? {
                    members: {
                      deleteMany: {},
                      create: input.accountIds.map(
                        /** Replace the complete unique membership set in the same transaction. */ (accountId) => ({
                          accountId,
                        }),
                      ),
                    },
                  }
                : {}),
            },
          }),
        );
      },
    );
  }
  /** Confirmed group deletion cascades only its membership metadata, never financial accounts. */
  async remove(id: string) {
    await this.db.accountGroup.delete({ where: { id } });
    return { ok: true };
  }
}
