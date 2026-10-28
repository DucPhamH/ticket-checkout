import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { getTrialBalance, getUserBalances } from '../../src/modules/ledger/ledger.balances';
import { settleGatewayResult } from '../../src/modules/payments/payments.settlement';
import { mockVnpayRefund } from '../helpers/vnpay';

// Relies on the seed: user 4 is the admin.
const app = createApp();
const TAG = '[event-cancellation.test]';
const ADMIN = '4';

const newUser = async (name: string) => (await prisma.user.create({ data: { name: `${TAG} ${name}` } })).id;

// An event with one listing of 100,000 VND tickets.
async function eventWithListing() {
  const seller = await newUser('seller');
  const event = await prisma.event.create({
    data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
  });
  const listing = await prisma.listing.create({
    data: { eventId: event.id, sellerId: seller, unitPrice: 100_000n, quantityTotal: 10, quantityAvailable: 10 },
  });
  return { seller, eventId: event.id, listingId: listing.id };
}

// A real order through the api, left PENDING.
async function buy(listingId: number, quantity: number) {
  const buyer = await newUser('buyer');
  const res = await request(app).post('/orders').set('X-User-Id', String(buyer)).send({ listingId, quantity });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
  return { buyer, orderId: res.body.order.id as number, payment };
}

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

const cancel = (eventId: number, userId = ADMIN) =>
  request(app).post(`/admin/events/${eventId}/cancel`).set('X-User-Id', userId);

const statusOf = async (orderId: number) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

// No cleanup: the test database is recreated on every run, and ledger rows can't be deleted anyway.
afterAll(() => prisma.$disconnect());

describe('POST /admin/events/:id/cancel', () => {
  it('takes paid orders out of escrow and refunds every buyer through VNPay', async () => {
    const { seller, eventId, listingId } = await eventWithListing();
    const a = await buy(listingId, 2);
    const b = await buy(listingId, 1);
    await paySucceeds(a);
    await paySucceeds(b);
    const unpaid = await buy(listingId, 1);
    const fetchSpy = mockVnpayRefund({});

    const res = await cancel(eventId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ eventId, cancelledOrders: 2, refundsSucceeded: 2, refundsFailed: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect([await statusOf(a.orderId), await statusOf(b.orderId)]).toEqual(['REFUNDED', 'REFUNDED']);
    expect(await statusOf(unpaid.orderId)).toBe('PENDING'); // never paid: nothing to refund
    expect(await getUserBalances(seller)).toEqual({ pending: 0n, available: 0n, refundPending: 0n });
    expect(await getUserBalances(a.buyer)).toMatchObject({ refundPending: 0n });
    expect(await prisma.refund.findUniqueOrThrow({ where: { orderId: a.orderId } })).toMatchObject({
      reason: 'EVENT_CANCELLED',
      amount: 220_000n,
      status: 'SUCCEEDED',
    });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ status: 'CANCELLED' });
    expect((await getTrialBalance()).total).toBe(0n);
  });

  it('keeps the money owed to the buyer when VNPay cannot refund yet', async () => {
    const { seller, eventId, listingId } = await eventWithListing();
    const order = await buy(listingId, 1);
    await paySucceeds(order);
    // No mock: every network call fails, as if VNPay were down.

    const res = await cancel(eventId);

    expect(res.body).toMatchObject({ cancelledOrders: 1, refundsSucceeded: 0, refundsFailed: 1 });
    expect(await statusOf(order.orderId)).toBe('REFUND_PENDING');
    expect(await prisma.refund.findUniqueOrThrow({ where: { orderId: order.orderId } })).toMatchObject({
      status: 'FAILED',
    });
    expect(await getUserBalances(order.buyer)).toMatchObject({ refundPending: 110_000n });
    expect(await getUserBalances(seller)).toMatchObject({ pending: 0n });
  });

  it('does nothing new when repeated', async () => {
    const { eventId, listingId } = await eventWithListing();
    await paySucceeds(await buy(listingId, 1));
    mockVnpayRefund({});
    await cancel(eventId);

    const again = await cancel(eventId);

    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ cancelledOrders: 0, refundsSucceeded: 0, refundsFailed: 0 });
  });

  it('refunds a payment that arrives after the cancellation, instead of putting it in escrow', async () => {
    const { seller, eventId, listingId } = await eventWithListing();
    const late = await buy(listingId, 1);
    await cancel(eventId);

    await paySucceeds(late);

    expect(await statusOf(late.orderId)).toBe('REFUND_PENDING');
    expect(await prisma.refund.findUniqueOrThrow({ where: { orderId: late.orderId } })).toMatchObject({
      reason: 'EVENT_ENDED',
    });
    expect(await getUserBalances(seller)).toMatchObject({ pending: 0n });
  });

  it('never leaves money in escrow when a payment races the cancellation (10 races)', async () => {
    for (let round = 0; round < 10; round++) {
      const { seller, eventId, listingId } = await eventWithListing();
      const order = await buy(listingId, 1);

      await Promise.all([cancel(eventId), paySucceeds(order)]);

      // Whichever won, the buyer is owed (or got) their money back and the seller holds nothing.
      expect(await getUserBalances(seller)).toEqual({ pending: 0n, available: 0n, refundPending: 0n });
      expect(await prisma.refund.findUnique({ where: { orderId: order.orderId } })).not.toBeNull();
      expect(await getUserBalances(order.buyer)).toMatchObject({ refundPending: 110_000n });
    }
    expect((await getTrialBalance()).total).toBe(0n);
  });

  it('refuses a completed event, an unknown event and a non-admin', async () => {
    const { eventId } = await eventWithListing();
    await request(app).post(`/admin/events/${eventId}/complete`).set('X-User-Id', ADMIN);

    const completed = await cancel(eventId);
    expect(completed.status).toBe(409);
    expect(completed.body.error.code).toBe('EVENT_COMPLETED');

    expect((await cancel(999_999)).body.error.code).toBe('EVENT_NOT_FOUND');
    expect((await cancel(eventId, '3')).status).toBe(403);
  });
});
