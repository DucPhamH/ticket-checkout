import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { getTrialBalance, getUserBalances } from '../../src/modules/ledger/ledger.balances';
import { settleGatewayResult } from '../../src/modules/payments/payments.settlement';
import { signPipeJoined } from '../../src/modules/payments/vnpay/vnpay.api';
import { formatVnpayDate } from '../../src/modules/payments/vnpay/vnpay.date';
import { mockVnpayRefund, TEST_SECRET } from '../helpers/vnpay';

// Relies on the seed: user 4 is the admin.
const app = createApp();
const TAG = '[refunds.test]';
const ADMIN = '4';

const newUser = async (name: string) => (await prisma.user.create({ data: { name: `${TAG} ${name}` } })).id;

/**
 * A refund owed for real: a buyer reserves, the event is completed, then their payment succeeds
 * (refund reason EVENT_ENDED, 1 ticket of 100,000 → 110,000 owed).
 */
async function owedRefund() {
  const seller = await newUser('seller');
  const buyer = await newUser('buyer');
  const event = await prisma.event.create({
    data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
  });
  const listing = await prisma.listing.create({
    data: { eventId: event.id, sellerId: seller, unitPrice: 100_000n, quantityTotal: 5, quantityAvailable: 5 },
  });
  const created = await request(app)
    .post('/orders')
    .set('X-User-Id', String(buyer))
    .send({ listingId: listing.id, quantity: 1 });
  const orderId: number = created.body.order.id;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
  await request(app).post(`/admin/events/${event.id}/complete`).set('X-User-Id', ADMIN);
  await settleGatewayResult(
    { paymentId: payment.id, orderId },
    {
      success: true,
      amount: String(payment.amount * 100n),
      responseCode: '00',
      transactionNo: '14999',
      payDate: '20261028150000',
      bankCode: 'NCB',
    },
  );
  const refund = await prisma.refund.findUniqueOrThrow({ where: { orderId } });
  return { buyer, orderId, payment, refund };
}

const retry = (refundId: number, userId = ADMIN) =>
  request(app).post(`/admin/refunds/${refundId}/retry`).set('X-User-Id', userId);

const orderStatus = async (orderId: number) =>
  (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

// No cleanup: the test database is recreated on every run, and ledger rows can't be deleted anyway.
afterAll(() => prisma.$disconnect());

describe('POST /admin/refunds/:id/retry', () => {
  it('refunds the buyer through VNPay and closes what we owed them', async () => {
    const { buyer, orderId, payment, refund } = await owedRefund();
    expect(await getUserBalances(buyer)).toMatchObject({ refundPending: 110_000n });
    const fetchSpy = mockVnpayRefund({ vnp_TxnRef: payment.txnRef, vnp_Amount: '11000000' });

    const res = await retry(refund.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: refund.id,
      status: 'SUCCEEDED',
      attempts: 1,
      lastError: null,
      amount: 110_000,
    });
    expect(await orderStatus(orderId)).toBe('REFUNDED');
    expect(await getUserBalances(buyer)).toMatchObject({ refundPending: 0n });
    expect((await getTrialBalance()).total).toBe(0n);

    // What we sent: a full refund of this payment, signed over the fields in VNPay's order.
    const sent = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(sent).toMatchObject({
      vnp_Command: 'refund',
      vnp_TransactionType: '02',
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: '11000000',
      vnp_TransactionNo: '14999',
      vnp_TransactionDate: formatVnpayDate(order.createdAt),
      vnp_CreateBy: `admin-${ADMIN}`,
    });
    const fields = [
      'vnp_RequestId',
      'vnp_Version',
      'vnp_Command',
      'vnp_TmnCode',
      'vnp_TransactionType',
      'vnp_TxnRef',
      'vnp_Amount',
      'vnp_TransactionNo',
      'vnp_TransactionDate',
      'vnp_CreateBy',
      'vnp_CreateDate',
      'vnp_IpAddr',
      'vnp_OrderInfo',
    ];
    expect(sent.vnp_SecureHash).toBe(signPipeJoined(TEST_SECRET, fields, sent));
  });

  it('never sends a refund that already succeeded', async () => {
    const { refund } = await owedRefund();
    const fetchSpy = mockVnpayRefund({});
    await retry(refund.id);

    const again = await retry(refund.id);

    expect(again.body).toMatchObject({ status: 'SUCCEEDED', attempts: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // only the first retry reached VNPay
  });

  it('records a refusal as FAILED, and a later retry can still succeed', async () => {
    const { orderId, refund } = await owedRefund();
    mockVnpayRefund({ vnp_ResponseCode: '95', vnp_Message: 'Giao dich goc that bai' });

    const refused = await retry(refund.id);

    expect(refused.body).toMatchObject({ status: 'FAILED', attempts: 1, lastError: expect.stringContaining('95') });
    expect(await orderStatus(orderId)).toBe('REFUND_PENDING');

    mockVnpayRefund({});
    expect((await retry(refund.id)).body).toMatchObject({ status: 'SUCCEEDED', attempts: 2, lastError: null });
  });

  it('records an unreachable VNPay or an unsigned answer as FAILED', async () => {
    const { refund } = await owedRefund();
    // No mock: the test setup makes every network call fail.
    expect((await retry(refund.id)).body).toMatchObject({ status: 'FAILED', lastError: expect.any(String) });

    mockVnpayRefund({}, { secret: 'not-our-secret' });
    expect((await retry(refund.id)).body).toMatchObject({
      status: 'FAILED',
      lastError: expect.stringContaining('signature'),
    });
  });

  it('sends a refund once when two retries are clicked at the same time', async () => {
    const { refund } = await owedRefund();
    const fetchSpy = mockVnpayRefund({}, { delayMs: 200 });

    const [a, b] = await Promise.all([retry(refund.id), retry(refund.id)]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect([a.body.status, b.body.status]).toEqual(['SUCCEEDED', 'SUCCEEDED']);
    expect(a.body.attempts).toBe(1);
  });

  it('answers 404 for an unknown refund and 403 for a non-admin', async () => {
    expect((await retry(999_999)).body.error.code).toBe('REFUND_NOT_FOUND');
    const { refund } = await owedRefund();
    expect((await retry(refund.id, '3')).status).toBe(403);
  });
});

describe('GET /admin/refunds', () => {
  it('lists refunds newest first with their buyer and event', async () => {
    const first = await owedRefund();
    const second = await owedRefund();

    const res = await request(app).get('/admin/refunds').set('X-User-Id', ADMIN).query({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.items.map((r: { id: number }) => r.id)).toEqual([second.refund.id, first.refund.id]);
    expect(res.body.items[0]).toMatchObject({
      orderId: second.orderId,
      buyer: { id: second.buyer },
      event: { name: `${TAG} event` },
      reason: 'EVENT_ENDED',
      status: 'PENDING',
      attempts: 0,
    });
  });
});
