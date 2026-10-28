// Every case runs inside a transaction that is rolled back: the ledger is append-only, so rows
// written by tests could never be cleaned up otherwise.
import { afterAll, describe, expect, it } from 'vitest';
import { ACCOUNTS } from '../../../src/constants/ledger';
import { prisma } from '../../../src/db/prisma';
import type { Prisma } from '../../../src/generated/prisma/client';
import { assertBalanced, credit, debit, postTransaction } from '../../../src/modules/ledger/ledger.service';

class Rollback extends Error {}

async function inRolledBackTx(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  await expect(
    prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

const checkDeferredNow = (tx: Prisma.TransactionClient) => tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;

// The posting a successful payment will make (C6): 2 × 380,000 → buyer pays 836,000.
const capture = (sellerId: number, key = 'test:capture') => ({
  kind: 'PAYMENT_CAPTURED' as const,
  idempotencyKey: key,
  lines: [
    debit(ACCOUNTS.gatewayClearing, 836_000n),
    credit(ACCOUNTS.sellerPending(sellerId), 722_000n),
    credit(ACCOUNTS.feePending, 114_000n),
  ],
});

afterAll(() => prisma.$disconnect());

describe('assertBalanced', () => {
  it('accepts lines that sum to zero', () => {
    expect(() => assertBalanced(capture(1).lines)).not.toThrow();
  });

  it.each([
    ['unbalanced', [debit(ACCOUNTS.gatewayClearing, 100n), credit(ACCOUNTS.feePending, 60n)], /sum to zero, got 40/],
    ['a single line', [debit(ACCOUNTS.gatewayClearing, 100n)], /at least 2 lines/],
    ['a zero line', [debit(ACCOUNTS.gatewayClearing, 0n), credit(ACCOUNTS.feePending, 0n)], /cannot be zero/],
  ])('rejects %s before reaching the database', (_case, lines, message) => {
    expect(() => assertBalanced(lines)).toThrow(message);
  });
});

describe('postTransaction', () => {
  it('writes the transaction and its lines, creating a seller account on first use', async () => {
    await inRolledBackTx(async (tx) => {
      const seller = await tx.user.create({ data: { name: '[ledger.test] seller' } });

      const result = await postTransaction(tx, { ...capture(seller.id), orderId: undefined });
      await checkDeferredNow(tx); // the balance trigger agrees

      expect(result.created).toBe(true);
      const entries = await tx.ledgerEntry.findMany({
        where: { transactionId: result.transactionId },
        include: { account: true },
        orderBy: { id: 'asc' },
      });
      expect(entries.map((e) => [e.account.code, e.amount])).toEqual([
        ['platform:gateway_clearing', 836_000n],
        [`seller:${seller.id}:pending`, -722_000n],
        ['platform:fee_pending', -114_000n],
      ]);
      const sellerAccount = entries[1].account;
      expect(sellerAccount).toMatchObject({ type: 'LIABILITY', userId: seller.id });
    });
  });

  it('posting the same key again writes nothing and returns the first transaction', async () => {
    await inRolledBackTx(async (tx) => {
      const seller = await tx.user.create({ data: { name: '[ledger.test] seller' } });

      const first = await postTransaction(tx, capture(seller.id, 'test:twice'));
      const second = await postTransaction(tx, capture(seller.id, 'test:twice'));

      expect(second).toEqual({ transactionId: first.transactionId, created: false });
      expect(await tx.ledgerEntry.count({ where: { transactionId: first.transactionId } })).toBe(3);
      expect(await tx.ledgerTransaction.count({ where: { idempotencyKey: 'test:twice' } })).toBe(1);
    });
  });

  it('rejects an unbalanced posting without writing anything', async () => {
    await inRolledBackTx(async (tx) => {
      const before = await tx.ledgerTransaction.count();
      await expect(
        postTransaction(tx, {
          kind: 'PAYMENT_CAPTURED',
          idempotencyKey: 'test:unbalanced',
          lines: [debit(ACCOUNTS.gatewayClearing, 100n), credit(ACCOUNTS.feePending, 99n)],
        }),
      ).rejects.toThrow(/sum to zero/);
      expect(await tx.ledgerTransaction.count()).toBe(before);
    });
  });

  it('a second poster of the same key waits for the first instead of failing', async () => {
    // Transaction A posts the key and holds it uncommitted; B tries the same key meanwhile.
    // B must wait (not error). When A rolls back, B goes ahead and creates it.
    let releaseA!: () => void;
    const aMayFinish = new Promise<void>((resolve) => (releaseA = resolve));
    let aPosted!: () => void;
    const aHasPosted = new Promise<void>((resolve) => (aPosted = resolve));

    const a = prisma
      .$transaction(
        async (tx) => {
          const seller = await tx.user.create({ data: { name: '[ledger.test] seller A' } });
          await postTransaction(tx, capture(seller.id, 'test:race'));
          aPosted();
          await aMayFinish;
          throw new Rollback();
        },
        { timeout: 10_000 },
      )
      .catch((error) => error);
    await aHasPosted;

    let bResult: { created: boolean } | undefined;
    const b = prisma
      .$transaction(
        async (tx) => {
          const seller = await tx.user.create({ data: { name: '[ledger.test] seller B' } });
          bResult = await postTransaction(tx, capture(seller.id, 'test:race'));
          throw new Rollback();
        },
        { timeout: 10_000 },
      )
      .catch((error) => error);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(bResult).toBeUndefined(); // still waiting on A's uncommitted key

    releaseA();
    expect(await a).toBeInstanceOf(Rollback);
    expect(await b).toBeInstanceOf(Rollback);
    expect(bResult).toEqual(expect.objectContaining({ created: true })); // A rolled back, so B wrote it
  });
});
