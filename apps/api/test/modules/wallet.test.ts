import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ACCOUNTS } from '../../src/constants/ledger';
import { prisma } from '../../src/db/prisma';
import { encodeCursor } from '../../src/lib/pagination';
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

describe('GET /me/ledger', () => {
  const ledgerOf = (userId: number, query: Record<string, string | number> = {}) =>
    request(app).get('/me/ledger').set('X-User-Id', String(userId)).query(query);

  // Three postings touching the seller (one of them twice) and one touching only someone else.
  async function sellerWithHistory() {
    const seller = await newUser();
    const other = await newUser();
    await post({
      kind: 'PAYMENT_CAPTURED',
      idempotencyKey: `${TAG}:hist:capture:${seller}`,
      lines: [
        debit(ACCOUNTS.gatewayClearing, 715_000n),
        credit(ACCOUNTS.sellerPending(seller), 617_500n),
        credit(ACCOUNTS.feePending, 97_500n),
      ],
    });
    await post({
      kind: 'LATE_PAYMENT',
      idempotencyKey: `${TAG}:hist:late:${other}`,
      lines: [debit(ACCOUNTS.gatewayClearing, 880_000n), credit(ACCOUNTS.buyerRefundPayable(other), 880_000n)],
    });
    await post({
      kind: 'EVENT_SETTLED',
      idempotencyKey: `${TAG}:hist:settle:${seller}`,
      lines: [debit(ACCOUNTS.sellerPending(seller), 617_500n), credit(ACCOUNTS.sellerAvailable(seller), 617_500n)],
    });
    return { seller, other };
  }

  it('lists only my accounts’ lines, newest first, signed as stored', async () => {
    const { seller } = await sellerWithHistory();

    const res = await ledgerOf(seller);

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
    expect(
      res.body.items.map((l: { kind: string; account: string; amount: number }) => [l.kind, l.account, l.amount]),
    ).toEqual([
      ['EVENT_SETTLED', `seller:${seller}:available`, -617_500],
      ['EVENT_SETTLED', `seller:${seller}:pending`, 617_500],
      ['PAYMENT_CAPTURED', `seller:${seller}:pending`, -617_500],
    ]);
    expect(res.body.items[0]).toMatchObject({ orderId: null, eventId: null, createdAt: expect.any(String) });
  });

  it('pages through the lines without repeats', async () => {
    const { seller } = await sellerWithHistory();
    const all = (await ledgerOf(seller)).body.items.map((l: { id: number }) => l.id);

    const first = await ledgerOf(seller, { limit: 2 });
    const second = await ledgerOf(seller, { limit: 2, cursor: first.body.nextCursor });

    expect([...first.body.items, ...second.body.items].map((l: { id: number }) => l.id)).toEqual(all);
    expect(second.body.nextCursor).toBeNull();
  });

  it('is empty for a user without ledger lines', async () => {
    expect((await ledgerOf(await newUser())).body).toEqual({ items: [], nextCursor: null });
  });

  it('rejects a malformed cursor', async () => {
    const res = await ledgerOf(await newUser(), { cursor: encodeCursor({ createdAt: 'x' }) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
