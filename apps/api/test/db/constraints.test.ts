// Proves the database itself rejects bad data, independent of application code.
// Each case runs inside a transaction that is always rolled back, so nothing is left behind
// (the ledger is append-only, so rows could not be cleaned up otherwise).
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma';
import type { Prisma } from '../../src/generated/prisma/client';

class Rollback extends Error {}

async function inRolledBackTx(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  await expect(
    prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

// Deferred constraint triggers normally run at COMMIT; this forces them to run now.
const checkDeferredNow = (tx: Prisma.TransactionClient) => tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;

async function postTransaction(tx: Prisma.TransactionClient, key: string, amounts: bigint[]) {
  const [a, b] = await tx.account.findMany({ orderBy: { id: 'asc' }, take: 2 });
  const ledgerTx = await tx.ledgerTransaction.create({ data: { kind: 'PAYMENT_CAPTURED', idempotencyKey: key } });
  for (const [i, amount] of amounts.entries()) {
    await tx.ledgerEntry.create({
      data: { transactionId: ledgerTx.id, accountId: (i % 2 === 0 ? a : b).id, amount },
    });
  }
  return ledgerTx;
}

afterAll(() => prisma.$disconnect());

describe('ledger', () => {
  it('accepts a balanced transaction', async () => {
    await inRolledBackTx(async (tx) => {
      await postTransaction(tx, 'test:balanced', [100n, -100n]);
      await checkDeferredNow(tx);
    });
  });

  it('rejects a transaction whose entries do not sum to zero', async () => {
    await inRolledBackTx(async (tx) => {
      await postTransaction(tx, 'test:unbalanced', [100n, -60n]);
      await expect(checkDeferredNow(tx)).rejects.toThrow(/unbalanced: entries sum to 40/);
    });
  });

  it('rejects a transaction with fewer than two entries', async () => {
    await inRolledBackTx(async (tx) => {
      await tx.ledgerTransaction.create({ data: { kind: 'PAYMENT_CAPTURED', idempotencyKey: 'test:empty' } });
      await expect(checkDeferredNow(tx)).rejects.toThrow(/at least 2 are required/);
    });
  });

  it('rejects a zero amount line', async () => {
    await inRolledBackTx(async (tx) => {
      await expect(postTransaction(tx, 'test:zero', [0n, 0n])).rejects.toThrow(/ledger_entries_amount_non_zero/);
    });
  });

  it('is append-only', async () => {
    await inRolledBackTx(async (tx) => {
      const ledgerTx = await postTransaction(tx, 'test:append-only', [100n, -100n]);
      await expect(
        tx.ledgerEntry.updateMany({ where: { transactionId: ledgerTx.id }, data: { amount: 1n } }),
      ).rejects.toThrow(/append-only/);
    });
  });

  it('rejects a second posting with the same idempotency key', async () => {
    await inRolledBackTx(async (tx) => {
      await postTransaction(tx, 'test:idempotent', [100n, -100n]);
      await expect(
        tx.ledgerTransaction.create({ data: { kind: 'PAYMENT_CAPTURED', idempotencyKey: 'test:idempotent' } }),
      ).rejects.toThrow(/Unique constraint/);
    });
  });
});

describe('marketplace checks', () => {
  it('keeps listing availability within 0..total', async () => {
    await inRolledBackTx(async (tx) => {
      const listing = await tx.listing.findFirstOrThrow();
      await expect(
        tx.listing.update({ where: { id: listing.id }, data: { quantityAvailable: listing.quantityTotal + 1 } }),
      ).rejects.toThrow(/listings_quantity_available_range/);
    });
  });

  it('rejects an order whose total does not add up', async () => {
    await inRolledBackTx(async (tx) => {
      const listing = await tx.listing.findFirstOrThrow();
      await expect(
        tx.order.create({
          data: {
            buyerId: 3,
            listingId: listing.id,
            quantity: 2,
            unitPrice: 100_000n,
            subtotal: 200_000n,
            buyerFee: 20_000n,
            sellerFee: 10_000n,
            total: 999_999n,
            expiresAt: new Date(),
          },
        }),
      ).rejects.toThrow(/orders_total_matches/);
    });
  });
});
