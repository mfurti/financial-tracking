import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Persist explicit reserve metadata and derive exact current progress only from eligible observed balances. */
@Injectable()
export class ReservesService {
  /** Receive the application-owned database without opening any bank connection. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Read one internally consistent target/designation/observation snapshot without mutating sources. */
  private async read(tx: Prisma.TransactionClient, now: Date) {
    const goal = await tx.reserveGoal.findUnique({ where: { id: 1 } });
    if (!goal) throw new AppError('RESERVE_NOT_CONFIGURED', 'Reserve-Einstellungen fehlen. Migration prüfen.', 503);
    const accounts = await tx.account.findMany({
      where: { presentation: { reserveEligible: true } },
      orderBy: { name: 'asc' },
      include: {
        presentation: true,
        balances: { where: { balanceType: 'BOOKED' }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
    });
    const eligible = accounts.filter(
      /** A designation never overrides activity or currency. */ (account) =>
        account.isActive && account.currency === 'EUR',
    );
    const components = eligible.map(
      /** Missing booked values remain unknown even when an available balance exists. */ (account) => {
        const balance = account.balances[0];
        return {
          accountId: account.id,
          name: account.name,
          currency: 'EUR' as const,
          amountCents: balance ? String(balance.amountCents) : null,
          observedAt: balance?.observedAt.toISOString() ?? null,
          source: balance?.source ?? null,
          stale: !!balance && now.getTime() - balance.observedAt.getTime() > 48 * 60 * 60 * 1000,
        };
      },
    );
    const known = components.filter(
      /** Count explicit zero and negative observations as known. */ (component) => component.amountCents !== null,
    );
    return c.reserveGoalSchema.parse({
      targetCents: String(goal.targetCents),
      updatedAt: goal.updatedAt.toISOString(),
      asOf: now.toISOString(),
      currentCents: known.length
        ? String(
            known.reduce(
              /** Sum only source integer cents without treating unknowns as observed zero. */ (sum, component) =>
                sum + BigInt(component.amountCents!),
              0n,
            ),
          )
        : null,
      coverage: eligible.length > 0 && known.length === eligible.length ? 'COMPLETE' : 'PARTIAL',
      eligibleCount: eligible.length,
      observedCount: known.length,
      presentations: accounts.map(
        /** Keep inactive/foreign designations visible so the owner can explicitly remove them. */ (account) => ({
          accountId: account.id,
          reserveEligible: true,
        }),
      ),
      excludedAccounts: accounts
        .filter(
          /** Explain selected accounts that cannot currently contribute. */ (account) =>
            !account.isActive || account.currency !== 'EUR',
        )
        .map(
          /** Currency exclusion remains explicit even for an inactive account. */ (account) => ({
            accountId: account.id,
            name: account.name,
            reason: account.currency !== 'EUR' ? 'NON_EUR' : 'INACTIVE',
          }),
        ),
      components,
    });
  }

  /** Get observed reserve progress without storing any derived balance or fabricating an initial observation. */
  async goal(now = new Date()) {
    return this.db.$transaction(/** Bind all source reads to one repeatable snapshot. */ (tx) => this.read(tx, now), {
      isolationLevel: 'RepeatableRead',
    });
  }

  /** Save only a validated positive target, then return progress from the same transaction. */
  async setGoal(input: z.infer<typeof c.reserveGoalInputSchema>, now = new Date()) {
    const value = c.reserveGoalInputSchema.parse(input);
    return this.db.$transaction(
      /** Target edits must not create or modify bank observations. */ async (tx) => {
        await tx.reserveGoal.update({ where: { id: 1 }, data: { targetCents: BigInt(value.targetCents) } });
        return this.read(tx, now);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Explicitly designate a real EUR account as Tagesgeld; never infer this from its imported account type. */
  async setPresentation(id: string, input: z.infer<typeof c.accountPresentationInputSchema>) {
    const accountId = c.idSchema.parse(id);
    const value = c.accountPresentationInputSchema.parse(input);
    return this.db.$transaction(
      /** Validate source currency before saving independent presentation metadata. */ async (tx) => {
        const account = await tx.account.findUnique({ where: { id: accountId } });
        if (!account) throw new AppError('NOT_FOUND', 'Konto nicht gefunden.', 404);
        if (value.reserveEligible && account.currency !== 'EUR')
          throw new AppError('RESERVE_CURRENCY', 'Nur ausdrücklich markierte EUR-Konten können zur Reserve beitragen.');
        return c.accountPresentationSchema.parse(
          await tx.accountPresentation.upsert({ where: { accountId }, create: { accountId, ...value }, update: value }),
        );
      },
    );
  }
}
