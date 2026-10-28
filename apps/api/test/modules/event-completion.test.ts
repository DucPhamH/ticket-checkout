import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { getTrialBalance, getUserBalances } from '../../src/modules/ledger/ledger.balances';
import { settleGatewayResult } from '../../src/modules/payments/payments.settlement';

// Relies on the seed: user 4 is the admin.
const app = createApp();
const TAG = '[event-completion.test]';
const ADMIN = '4';

const newUser = async (name: string) => (await prisma.user.create({ data: { name: `${TAG} ${name}` } })).id;

// An event already under way (only a started event can be completed), one listing of 100,000 VND tickets.
async function eventWithListing(tickets = 10) {
  const seller = await newUser('seller');
  const event = await prisma.event.create({
    data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() - 60_000) }, // under way: can be completed
  });
  const listing = await prisma.listing.create({
    data: {
      eventId: event.id,
      sellerId: seller,
      unitPrice: 100_000n,
      quantityTotal: tickets,
      quantityAvailable: tickets,
    },
  });
  return { seller, eventId: event.id, listingId: listing.id };
}

// A real order through the api, left PENDING.
async function buy(listingId: number, quantity: number) {
  const buyer = await newUser('buyer');
  const res = await request(app).post('/orders').set('X-User-Id', String(buyer)).send({ listingId, quantity });
  expect(res.status).toBe(201);
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
  return { orderId: res.body.order.id as number, payment };
}

// VNPay reports the payment as successful (as IPN or querydr would).
const paySucceeds = ({ orderId, payment }: Awaited<ReturnType<typeof buy>>) =>
  settleGatewayResult(
    { paymentId: payment.id, orderId },
    {
      success: true,
      amount: String(payment.amount * 100n),
      responseCode: '00',
      transactionNo: '1',
      payDate: null,
      bankCode: 'NCB',
    },
  );

const complete = (eventId: number, userId = ADMIN) =>
  request(app).post(`/admin/events/${eventId}/complete`).set('X-User-Id', userId);

const statusOf = async (orderId: number) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
const availableOf = async (listingId: number) =>
  (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable;

// No cleanup: the test database is recreated on every run, and ledger rows can't be deleted anyway.
afterAll(() => prisma.$disconnect());

describe('POST /admin/events/:id/complete', () => {
  it('releases the escrow of every paid order, and only of paid ones', async () => {
    const { seller, eventId, listingId } = await eventWithListing();
    await paySucceeds(await buy(listingId, 2)); // 200,000 → seller 190,000, fee 30,000 (total 220,000)
    await paySucceeds(await buy(listingId, 1)); // 100,000 → seller 95,000, fee 15,000 (total 110,000)
    const unpaid = await buy(listingId, 1); // still PENDING: not settled
    const feeRevenueBefore = await feeRevenue();
    expect(await getUserBalances(seller)).toEqual({ pending: 285_000n, available: 0n, refundPending: 0n });

    const res = await complete(eventId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ eventId, settledOrders: 2, sellerPayouts: 285_000, platformRevenue: 45_000 });
    expect(await getUserBalances(seller)).toEqual({ pending: 0n, available: 285_000n, refundPending: 0n });
    expect((await feeRevenue()) - feeRevenueBefore).toBe(-45_000n); // revenue is credit-negative as stored
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: 'COMPLETED',
      completedAt: expect.any(Date),
    });
    expect(await statusOf(unpaid.orderId)).toBe('PENDING');
    expect((await getTrialBalance()).total).toBe(0n);
  });

  it('settles nothing new when repeated', async () => {
    const { seller, eventId, listingId } = await eventWithListing();
    await paySucceeds(await buy(listingId, 1));
    await complete(eventId);

    const again = await complete(eventId);

    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ settledOrders: 0, sellerPayouts: 0, platformRevenue: 0 });
    expect(await getUserBalances(seller)).toEqual({ pending: 0n, available: 95_000n, refundPending: 0n });
  });

  it('refunds a payment that arrives after the event was completed, and frees its tickets', async () => {
    const { seller, eventId, listingId } = await eventWithListing(5);
    const late = await buy(listingId, 2); // holds 2 of 5
    await complete(eventId);

    await paySucceeds(late);

    expect(await statusOf(late.orderId)).toBe('REFUND_PENDING');
    expect(await prisma.refund.findUniqueOrThrow({ where: { orderId: late.orderId } })).toMatchObject({
      reason: 'EVENT_ENDED',
      amount: 220_000n,
    });
    expect(await availableOf(listingId)).toBe(5);
    // Nothing entered the seller's escrow after it was settled.
    expect(await getUserBalances(seller)).toEqual({ pending: 0n, available: 0n, refundPending: 0n });
  });

  it('stops new orders once the event is completed', async () => {
    const { eventId, listingId } = await eventWithListing();
    await complete(eventId);
    const buyer = await newUser('buyer');
    const res = await request(app).post('/orders').set('X-User-Id', String(buyer)).send({ listingId, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LISTING_NOT_ON_SALE');
  });

  it('never leaves money in escrow when a payment races the completion (10 races)', async () => {
    for (let round = 0; round < 10; round++) {
      const { seller, eventId, listingId } = await eventWithListing();
      const order = await buy(listingId, 1);

      const [completion] = await Promise.all([complete(eventId), paySucceeds(order)]);
      expect(completion.status).toBe(200);

      // Either the payment won (PAID, then settled) or the completion won (refund owed). Never stuck.
      const status = await statusOf(order.orderId);
      const balances = await getUserBalances(seller);
      if (status === 'PAID') {
        expect(balances).toEqual({ pending: 0n, available: 95_000n, refundPending: 0n });
      } else {
        expect(status).toBe('REFUND_PENDING');
        expect(balances).toEqual({ pending: 0n, available: 0n, refundPending: 0n });
      }
    }
    expect((await getTrialBalance()).total).toBe(0n);
  });

  it('refuses an event that has not started yet, and leaves it on sale', async () => {
    const { eventId, listingId } = await eventWithListing();
    await prisma.event.update({ where: { id: eventId }, data: { startsAt: new Date(Date.now() + 86_400_000) } });
    await paySucceeds(await buy(listingId, 1));

    const res = await complete(eventId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_NOT_STARTED');
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ status: 'ACTIVE' });
  });

  it('refuses a cancelled event, an unknown event and a non-admin', async () => {
    const { eventId } = await eventWithListing();
    await prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });

    const cancelled = await complete(eventId);
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.error.code).toBe('EVENT_CANCELLED');

    const unknown = await complete(999_999);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('EVENT_NOT_FOUND');

    expect((await complete(eventId, '3')).status).toBe(403);
  });
});

async function feeRevenue() {
  const { accounts } = await getTrialBalance();
  return accounts.find((account) => account.code === 'platform:fee_revenue')?.balance ?? 0n;
}
