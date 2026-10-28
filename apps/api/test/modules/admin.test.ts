import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { calculateOrderAmounts } from '@tc/shared';
import { createApp } from '../../src/app';
import { ACCOUNTS } from '../../src/constants/ledger';
import { prisma } from '../../src/db/prisma';
import { credit, debit, postTransaction } from '../../src/modules/ledger/ledger.service';

// Relies on the seed: user 4 is the admin, user 3 a buyer.
const app = createApp();
const TAG = '[admin.test]';
const ADMIN = '4';
const BUYER = '3';

afterAll(() => prisma.$disconnect());

describe('admin access', () => {
  it('refuses a user who is not an admin', async () => {
    const res = await request(app).get('/admin/trial-balance').set('X-User-Id', BUYER);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_ONLY');
  });

  it('refuses a request without a user', async () => {
    const res = await request(app).get('/admin/trial-balance');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/trial-balance', () => {
  it('lists every account with its signed balance, totalling zero', async () => {
    const seller = (await prisma.user.create({ data: { name: `${TAG} seller` } })).id;
    await prisma.$transaction((tx) =>
      postTransaction(tx, {
        kind: 'PAYMENT_CAPTURED',
        idempotencyKey: `${TAG}:capture:${seller}`,
        lines: [
          debit(ACCOUNTS.gatewayClearing, 715_000n),
          credit(ACCOUNTS.sellerPending(seller), 617_500n),
          credit(ACCOUNTS.feePending, 97_500n),
        ],
      }),
    );

    const res = await request(app).get('/admin/trial-balance').set('X-User-Id', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.accounts).toContainEqual({
      code: `seller:${seller}:pending`,
      type: 'LIABILITY',
      balance: -617_500,
    });
    // Seeded platform accounts appear even before they are used.
    const codes = res.body.accounts.map((account: { code: string }) => account.code);
    expect(codes).toEqual(expect.arrayContaining(['platform:gateway_clearing', 'platform:fee_revenue']));
    expect(res.body.accounts.reduce((sum: number, a: { balance: number }) => sum + a.balance, 0)).toBe(0);
  });
});

describe('GET /admin/events', () => {
  type AdminEvent = { id: number; status: string; paidOrders: number; ticketsSold: number; paidTotal: number };
  // Far in the future, so these events sort after every other test's.
  const FAR = Date.parse('2099-01-01T00:00:00Z');

  // The database requires completed_at / cancelled_at to match the status.
  const makeEvent = (name: string, startsAt: number, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'ACTIVE') =>
    prisma.event.create({
      data: {
        name: `${TAG} ${name}`,
        venue: 'v',
        city: 'c',
        startsAt: new Date(startsAt),
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
      },
    });

  async function order(
    listingId: number,
    buyerId: number,
    quantity: number,
    status: 'PAID' | 'PENDING' | 'REFUND_PENDING',
  ) {
    const amounts = calculateOrderAmounts(100_000, quantity);
    await prisma.order.create({
      data: {
        buyerId,
        listingId,
        quantity,
        unitPrice: 100_000n,
        subtotal: BigInt(amounts.subtotal),
        buyerFee: BigInt(amounts.buyerFee),
        sellerFee: BigInt(amounts.sellerFee),
        total: BigInt(amounts.total),
        status,
        expiresAt: new Date(Date.now() + 900_000),
      },
    });
  }

  // Walks every page and keeps this file's events.
  async function ourEvents(limit: number) {
    const found: AdminEvent[] = [];
    let cursor: string | null = null;
    do {
      const res = await request(app)
        .get('/admin/events')
        .set('X-User-Id', ADMIN)
        .query(cursor ? { limit, cursor } : { limit });
      expect(res.status).toBe(200);
      found.push(...res.body.items);
      cursor = res.body.nextCursor;
    } while (cursor);
    return found;
  }

  it('lists events of every status, soonest first, across pages', async () => {
    const later = await makeEvent('later', FAR + 3_000, 'CANCELLED');
    const first = await makeEvent('first', FAR + 1_000, 'COMPLETED');
    const middle = await makeEvent('middle', FAR + 2_000);

    const ids = (await ourEvents(2)).map((event) => event.id);

    expect(ids.slice(-3)).toEqual([first.id, middle.id, later.id]);
    expect(new Set(ids).size).toBe(ids.length); // no repeats
  });

  it('counts only paid orders in the sales', async () => {
    const event = await makeEvent('sales', FAR + 10_000);
    const seller = (await prisma.user.create({ data: { name: `${TAG} seller` } })).id;
    const listing = await prisma.listing.create({
      data: { eventId: event.id, sellerId: seller, unitPrice: 100_000n, quantityTotal: 10, quantityAvailable: 3 },
    });
    await order(listing.id, Number(BUYER), 2, 'PAID');
    await order(listing.id, Number(BUYER), 1, 'PAID');
    await order(listing.id, Number(BUYER), 3, 'PENDING');
    await order(listing.id, Number(BUYER), 1, 'REFUND_PENDING');

    const found = (await ourEvents(50)).find((e) => e.id === event.id);

    expect(found).toMatchObject({ status: 'ACTIVE', paidOrders: 2, ticketsSold: 3, paidTotal: 330_000 });
  });

  it('is admin only', async () => {
    expect((await request(app).get('/admin/events').set('X-User-Id', BUYER)).status).toBe(403);
  });
});
