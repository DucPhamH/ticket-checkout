import { prisma } from '../../db/prisma';

/**
 * One page of the ledger lines on a user's accounts, newest first. Entries are append-only and
 * their ids only grow, so the id alone is a stable keyset cursor.
 */
export function listUserLedgerEntries(userId: number, page: { limit: number; afterId?: number }) {
  return prisma.ledgerEntry.findMany({
    where: { account: { userId }, ...(page.afterId !== undefined && { id: { lt: page.afterId } }) },
    orderBy: { id: 'desc' },
    take: page.limit + 1, // one extra row tells the caller another page exists
    include: {
      account: { select: { code: true } },
      transaction: { select: { kind: true, orderId: true, eventId: true, createdAt: true } },
    },
  });
}

export type UserLedgerEntry = Awaited<ReturnType<typeof listUserLedgerEntries>>[number];
