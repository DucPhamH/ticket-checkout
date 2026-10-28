import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { settleGatewayResult } from '../../src/modules/payments/payments.settlement';

// Relies on the seed: user 4 is the admin.
const app = createApp();
const TAG = '[listings.test]';
const ADMIN = 4;

let eventId: number;

const newUser = async (name = 'user') => (await prisma.user.create({ data: { name: `${TAG} ${name}` } })).id;

const sell = (sellerId: number, body: Record<string, unknown>) =>
  request(app)
    .post('/listings')
    .set('X-User-Id', String(sellerId))
    .send({ eventId, unitPrice: 500_000, quantity: 3, ...body });

const withdraw = (sellerId: number, listingId: number) =>
  request(app).post(`/listings/${listingId}/withdraw`).set('X-User-Id', String(sellerId));

const buy = (buyerId: number, listingId: number, quantity = 1) =>
  request(app).post('/orders').set('X-User-Id', String(buyerId)).send({ listingId, quantity });

const myListings = (sellerId: number, query: Record<string, string | number> = {}) =>
  request(app).get('/me/listings').set('X-User-Id', String(sellerId)).query(query);

const onSaleIds = async () =>
  (await request(app).get(`/events/${eventId}`)).body.listings.map((listing: { id: number }) => listing.id);

const makeEvent = (data: { startsAt?: Date; status?: 'COMPLETED' } = {}) =>
  prisma.event.create({
    data: {
      name: `${TAG} event`,
      venue: 'v',
      city: 'c',
      startsAt: data.startsAt ?? new Date(Date.now() + 86_400_000),
      status: data.status,
      completedAt: data.status === 'COMPLETED' ? new Date() : null,
    },
  });

beforeAll(async () => {
  eventId = (await makeEvent()).id;
});

// No cleanup: the test database is recreated on every run.
afterAll(() => prisma.$disconnect());

describe('POST /listings', () => {
  it('puts the tickets on sale for buyers', async () => {
    const seller = await newUser('seller');

    const res = await sell(seller, { unitPrice: 450_000, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      event: { id: eventId, status: 'ACTIVE' },
      unitPrice: 450_000,
      status: 'ACTIVE',
      quantityTotal: 2,
      quantityAvailable: 2,
      ticketsReserved: 0,
      ticketsSold: 0,
      withdrawnAt: null,
    });
    expect(await onSaleIds()).toContain(res.body.id);
    expect((await buy(await newUser('buyer'), res.body.id, 2)).status).toBe(201);
  });

  it.each([
    ['a price that is not a multiple of 1,000', { unitPrice: 450_500 }],
    ['a price under 10,000', { unitPrice: 9_000 }],
    ['a price over 100,000,000', { unitPrice: 100_001_000 }],
    ['no tickets', { quantity: 0 }],
    ['more than 50 tickets', { quantity: 51 }],
    ['a price sent as text', { unitPrice: '500000' }],
  ])('rejects %s with 400', async (_case, body) => {
    const res = await sell(await newUser(), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts the price limits themselves', async () => {
    const seller = await newUser();
    expect((await sell(seller, { unitPrice: 10_000, quantity: 1 })).status).toBe(201);
    expect((await sell(seller, { unitPrice: 100_000_000, quantity: 50 })).status).toBe(201);
  });

  it('refuses an admin, an unknown event, a completed event and one that has started', async () => {
    expect((await sell(ADMIN, {})).body.error.code).toBe('ADMIN_CANNOT_SELL');

    const seller = await newUser();
    const unknown = await sell(seller, { eventId: 999_999 });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('EVENT_NOT_FOUND');

    for (const event of [
      await makeEvent({ status: 'COMPLETED' }),
      await makeEvent({ startsAt: new Date(Date.now() - 60_000) }),
    ]) {
      const res = await sell(seller, { eventId: event.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EVENT_NOT_ON_SALE');
    }
  });
});

describe('POST /listings/:id/withdraw', () => {
  it('takes the listing off sale, but a buyer already holding tickets can still pay', async () => {
    const seller = await newUser('seller');
    const listingId = (await sell(seller, { quantity: 3 })).body.id;
    const held = await buy(await newUser('buyer'), listingId, 1);

    const res = await withdraw(seller, listingId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'WITHDRAWN', withdrawnAt: expect.any(String), ticketsReserved: 1 });
    expect(await onSaleIds()).not.toContain(listingId);
    const late = await buy(await newUser('buyer'), listingId, 1);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('LISTING_NOT_ON_SALE');

    // The reservation made before the withdrawal is honoured.
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: held.body.order.id } });
    await settleGatewayResult(
      { paymentId: payment.id, orderId: held.body.order.id },
      {
        success: true,
        amount: String(payment.amount * 100n),
        responseCode: '00',
        transactionNo: '1',
        payDate: null,
        bankCode: null,
      },
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: held.body.order.id } })).status).toBe('PAID');
  });

  it('is harmless when repeated', async () => {
    const seller = await newUser();
    const listingId = (await sell(seller, {})).body.id;
    const first = await withdraw(seller, listingId);
    const second = await withdraw(seller, listingId);
    expect(second.status).toBe(200);
    expect(second.body.withdrawnAt).toBe(first.body.withdrawnAt);
  });

  it('answers 404 for someone else’s listing and leaves it on sale', async () => {
    const listingId = (await sell(await newUser('owner'), {})).body.id;
    const res = await withdraw(await newUser('stranger'), listingId);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LISTING_NOT_FOUND');
    expect(await onSaleIds()).toContain(listingId);
  });
});

describe('GET /me/listings', () => {
  it('lists my listings newest first, with tickets reserved and sold, page by page', async () => {
    const seller = await newUser('seller');
    const first = (await sell(seller, { quantity: 5 })).body.id;
    const second = (await sell(seller, { quantity: 2 })).body.id;
    const third = (await sell(seller, { quantity: 1 })).body.id;
    await sell(await newUser('someone else'), {});

    const paid = await buy(await newUser('buyer'), first, 2);
    await prisma.order.update({ where: { id: paid.body.order.id }, data: { status: 'PAID', paidAt: new Date() } });
    await buy(await newUser('buyer'), first, 1); // still waiting for payment

    const page1 = await myListings(seller, { limit: 2 });
    const page2 = await myListings(seller, { limit: 2, cursor: page1.body.nextCursor });

    expect(page1.body.items.map((l: { id: number }) => l.id)).toEqual([third, second]);
    expect(page2.body.items.map((l: { id: number }) => l.id)).toEqual([first]);
    expect(page2.body.nextCursor).toBeNull();
    expect(page2.body.items[0]).toMatchObject({
      quantityTotal: 5,
      quantityAvailable: 2,
      ticketsReserved: 1,
      ticketsSold: 2,
    });
  });
});
