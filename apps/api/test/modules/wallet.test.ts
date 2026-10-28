import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ACCOUNTS } from '../../src/constants/ledger';
import { prisma } from '../../src/db/prisma';
import { credit, debit, postTransaction, type PostingInput } from '../../src/modules/ledger/ledger.service';

const app = createApp();
const TAG = '[wallet.test]';

const newUser = async () => (await prisma.user.create({ data: { name: `${TAG} user` } })).id;
const post = (input: PostingInput) => prisma.$transaction((tx) => postTransaction(tx, input));
const balancesOf = (userId: number) => request(app).get('/me/balances').set('X-User-Id', String(userId));

// No cleanup: the test database is recreated on every run, and ledger rows can't be deleted anyway.
afterAll(() => prisma.$disconnect());

describe('GET /me/balances', () => {
  it('is all zeros for a user with no ledger accounts yet', async () => {
    const res = await balancesOf(await newUser());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pending: 0, available: 0, refundPending: 0 });
  });

  it('sums the user’s accounts from the ledger, and only theirs', async () => {
    const seller = await newUser();
    const buyer = await newUser();
    const someoneElse = await newUser();

    // Two sales into escrow: 617,500 + 361,000.
    for (const [key, total, payout] of [
      ['a', 715_000n, 617_500n],
      ['b', 418_000n, 361_000n],
    ] as const) {
      await post({
        kind: 'PAYMENT_CAPTURED',
        idempotencyKey: `${TAG}:capture:${seller}:${key}`,
        lines: [
          debit(ACCOUNTS.gatewayClearing, total),
          credit(ACCOUNTS.sellerPending(seller), payout),
          credit(ACCOUNTS.feePending, total - payout),
        ],
      });
    }
    // The first event takes place: its payout moves from pending to available.
    await post({
      kind: 'EVENT_SETTLED',
      idempotencyKey: `${TAG}:settle:${seller}`,
      lines: [debit(ACCOUNTS.sellerPending(seller), 617_500n), credit(ACCOUNTS.sellerAvailable(seller), 617_500n)],
    });
    // A late payment owed back to the buyer.
    await post({
      kind: 'LATE_PAYMENT',
      idempotencyKey: `${TAG}:late:${buyer}`,
      lines: [debit(ACCOUNTS.gatewayClearing, 880_000n), credit(ACCOUNTS.buyerRefundPayable(buyer), 880_000n)],
    });

    expect((await balancesOf(seller)).body).toEqual({ pending: 361_000, available: 617_500, refundPending: 0 });
    expect((await balancesOf(buyer)).body).toEqual({ pending: 0, available: 0, refundPending: 880_000 });
    expect((await balancesOf(someoneElse)).body).toEqual({ pending: 0, available: 0, refundPending: 0 });
  });

  it('requires a user', async () => {
    const res = await request(app).get('/me/balances');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_USER_ID');
  });
});
