import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateOrderAmounts } from '@tc/shared';
import { createApp } from '../../src/app';
import { verifyVnpaySignature } from '../../src/modules/payments/vnpay/vnpay.signature';
import { formatVnpayDate } from '../../src/modules/payments/vnpay/vnpay.date';
import { prisma } from '../../src/db/prisma';

// Own fixtures (tagged, removed afterwards) so the seed data is never touched.
const app = createApp();
const TAG = '[orders.test]';

let sellerId: number;
let buyerIds: number[];
let adminId: number;
let eventId: number;

async function makeListing(quantity: number, unitPrice = 450_000n, extra: Record<string, unknown> = {}) {
  const listing = await prisma.listing.create({
    data: { eventId, sellerId, unitPrice, quantityTotal: Math.max(quantity, 1), quantityAvailable: quantity, ...extra },
  });
  return listing.id;
}

const buy = (userId: number, listingId: number, quantity: number) =>
  request(app).post('/orders').set('X-User-Id', String(userId)).send({ listingId, quantity });

const availableOf = async (listingId: number) =>
  (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable;

beforeAll(async () => {
  sellerId = (await prisma.user.create({ data: { name: `${TAG} seller` } })).id;
  buyerIds = await Promise.all(
    Array.from({ length: 10 }, async (_, i) => (await prisma.user.create({ data: { name: `${TAG} buyer ${i}` } })).id),
  );
  adminId = (await prisma.user.create({ data: { name: `${TAG} admin`, role: 'ADMIN' } })).id;
  eventId = (
    await prisma.event.create({
      data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
    })
  ).id;
});

afterAll(async () => {
  const events = await prisma.event.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const eventIds = events.map((e) => e.id);
  await prisma.payment.deleteMany({ where: { order: { listing: { eventId: { in: eventIds } } } } });
  await prisma.order.deleteMany({ where: { listing: { eventId: { in: eventIds } } } });
  await prisma.listing.deleteMany({ where: { eventId: { in: eventIds } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('POST /orders', () => {
  it('creates a PENDING order, freezes the amounts and reserves the tickets', async () => {
    const listingId = await makeListing(4, 450_000n);
    const before = Date.now();

    const res = await buy(buyerIds[0], listingId, 2);

    expect(res.status).toBe(201);
    const expected = calculateOrderAmounts(450_000, 2);
    expect(res.body.order).toMatchObject({
      status: 'PENDING',
      quantity: 2,
      unitPrice: 450_000,
      subtotal: expected.subtotal,
      buyerFee: expected.buyerFee,
      total: expected.total,
      seller: { id: sellerId },
      event: { id: eventId },
      paidAt: null,
    });
    const minutes = (new Date(res.body.order.expiresAt).getTime() - before) / 60_000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThan(15.1);
    expect(await availableOf(listingId)).toBe(2);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(stored.sellerFee).toBe(BigInt(expected.sellerFee)); // kept for the ledger, not exposed
  });

  it('sells the last ticket to exactly one of two simultaneous buyers', async () => {
    const listingId = await makeListing(1);

    const results = await Promise.all([buy(buyerIds[1], listingId, 1), buy(buyerIds[2], listingId, 1)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe('NOT_ENOUGH_TICKETS');
    expect(await availableOf(listingId)).toBe(0);
    expect(await prisma.order.count({ where: { listingId } })).toBe(1);
    expect(await prisma.payment.count({ where: { order: { listingId } } })).toBe(1); // the loser opened no payment
  });

  it('never oversells under heavy contention (10 buyers, 3 tickets)', async () => {
    const listingId = await makeListing(3);

    const results = await Promise.all(buyerIds.map((buyerId) => buy(buyerId, listingId, 1)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(await availableOf(listingId)).toBe(0);
    expect(await prisma.order.count({ where: { listingId } })).toBe(3);
  });

  it('rejects asking for more tickets than are left, without reserving any', async () => {
    const listingId = await makeListing(2);
    const res = await buy(buyerIds[0], listingId, 3);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_ENOUGH_TICKETS');
    expect(await availableOf(listingId)).toBe(2);
  });

  it('does not let a seller buy their own listing', async () => {
    const res = await buy(sellerId, await makeListing(2), 1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWN_LISTING');
  });

  it('does not let an admin buy', async () => {
    const res = await buy(adminId, await makeListing(2), 1);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_CANNOT_BUY');
  });

  it('rejects a withdrawn listing', async () => {
    const listingId = await makeListing(2, 450_000n, { status: 'WITHDRAWN', withdrawnAt: new Date() });
    const res = await buy(buyerIds[0], listingId, 1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LISTING_NOT_ON_SALE');
  });

  it('rejects a listing whose event is no longer active', async () => {
    const closed = await prisma.event.create({
      data: {
        name: `${TAG} closed`,
        venue: 'v',
        city: 'c',
        startsAt: new Date(),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    const listing = await prisma.listing.create({
      data: { eventId: closed.id, sellerId, unitPrice: 100_000n, quantityTotal: 1, quantityAvailable: 1 },
    });
    const res = await buy(buyerIds[0], listing.id, 1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LISTING_NOT_ON_SALE');
  });

  it('answers 404 for an unknown listing', async () => {
    const res = await buy(buyerIds[0], 99_999_999, 1);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LISTING_NOT_FOUND');
  });

  it.each([
    ['zero quantity', { listingId: 1, quantity: 0 }],
    ['too many tickets', { listingId: 1, quantity: 11 }],
    ['fractional quantity', { listingId: 1, quantity: 1.5 }],
    ['missing listingId', { quantity: 1 }],
    ['quantity as a string', { listingId: 1, quantity: '2' }],
  ])('answers 400 for %s', async (_case, body) => {
    const res = await request(app).post('/orders').set('X-User-Id', String(buyerIds[0])).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await request(app)
      .post('/orders')
      .set('X-User-Id', String(buyerIds[0]))
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('requires a user', async () => {
    const res = await request(app).post('/orders').send({ listingId: 1, quantity: 1 });
    expect(res.status).toBe(401);
  });
});

describe('GET /orders/:id', () => {
  it('returns the order to its buyer', async () => {
    const created = await buy(buyerIds[0], await makeListing(2), 1);
    const res = await request(app).get(`/orders/${created.body.order.id}`).set('X-User-Id', String(buyerIds[0]));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body.order);
  });

  it("hides someone else's order behind a 404", async () => {
    const created = await buy(buyerIds[0], await makeListing(2), 1);
    const res = await request(app).get(`/orders/${created.body.order.id}`).set('X-User-Id', String(buyerIds[1]));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('answers 400 for a malformed id', async () => {
    const res = await request(app).get('/orders/abc').set('X-User-Id', String(buyerIds[0]));
    expect(res.status).toBe(400);
  });
});

describe('payment opened with the order', () => {
  const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

  it('creates a PENDING payment for the order total and a signed VNPay URL', async () => {
    const listingId = await makeListing(4, 450_000n);
    const res = await buy(buyerIds[0], listingId, 2);
    expect(res.status).toBe(201);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
    expect(payment).toMatchObject({ status: 'PENDING', provider: 'VNPAY', amount: 990_000n });
    expect(payment.txnRef).toMatch(new RegExp(`^${res.body.order.id}T[0-9a-z]+$`));

    const params = query(res.body.paymentUrl);
    expect(res.body.paymentUrl.startsWith('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?')).toBe(true);
    expect(verifyVnpaySignature(params, 'TEST_SECRET_FOR_UNIT_TESTS_ONLY')).toBe(true);
    expect(params).toMatchObject({
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: '99000000', // 990,000 VND × 100
      vnp_ExpireDate: formatVnpayDate(new Date(res.body.order.expiresAt)), // = end of the reservation
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${res.body.order.id}`,
    });
    expect(params.vnp_ReturnUrl).toMatch(/\/payments\/vnpay\/return\/vi$/);
  });

  it('uses the requested language for the payment page and the return page', async () => {
    const res = await request(app)
      .post('/orders')
      .set('X-User-Id', String(buyerIds[0]))
      .send({ listingId: await makeListing(2), quantity: 1, locale: 'en' });
    const params = query(res.body.paymentUrl);
    expect(params.vnp_Locale).toBe('en');
    expect(params.vnp_ReturnUrl).toMatch(/\/return\/en$/);
  });

  it("passes the buyer's IP forwarded by web", async () => {
    const res = await request(app)
      .post('/orders')
      .set('X-User-Id', String(buyerIds[0]))
      .set('X-Forwarded-For', '203.0.113.7, 10.0.0.1')
      .send({ listingId: await makeListing(2), quantity: 1 });
    expect(query(res.body.paymentUrl).vnp_IpAddr).toBe('203.0.113.7');
  });

  it('gives every payment its own reference', async () => {
    const listingId = await makeListing(5);
    const results = await Promise.all([1, 2, 3].map(() => buy(buyerIds[0], listingId, 1)));
    const refs = results.map((r) => query(r.body.paymentUrl).vnp_TxnRef);
    expect(new Set(refs).size).toBe(3);
  });

  it('opens no payment when the reservation fails', async () => {
    const listingId = await makeListing(1);
    await buy(buyerIds[0], listingId, 5);
    expect(await prisma.payment.count({ where: { order: { listingId } } })).toBe(0);
  });
});
