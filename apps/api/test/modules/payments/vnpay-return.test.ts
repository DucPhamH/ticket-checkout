import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/prisma';
import { signVnpayParams } from '../../../src/modules/payments/vnpay/vnpay.signature';
import { mockVnpayQuery } from '../../helpers/vnpay';

const app = createApp();
const TAG = '[vnpay-return.test]';
const SECRET = 'TEST_SECRET_FOR_UNIT_TESTS_ONLY';
const WEB = 'http://localhost:3000';

let buyerId: number;
let eventId: number;

// A real order + payment created through the api, as the buyer would.
async function openPayment() {
  const seller = await prisma.user.create({ data: { name: `${TAG} seller` } });
  const listing = await prisma.listing.create({
    data: { eventId, sellerId: seller.id, unitPrice: 100_000n, quantityTotal: 2, quantityAvailable: 2 },
  });
  const res = await request(app)
    .post('/orders')
    .set('X-User-Id', String(buyerId))
    .send({ listingId: listing.id, quantity: 1 });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
  return { orderId: res.body.order.id as number, payment };
}

// What VNPay appends to the return URL, signed like VNPay signs it.
function vnpayQuery(fields: Record<string, string>, secret = SECRET) {
  return { ...fields, vnp_SecureHash: signVnpayParams(fields, secret) };
}

const returned = (txnRef: string, responseCode = '00', transactionStatus = '00') =>
  vnpayQuery({
    vnp_Amount: '11000000',
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: 'Thanh toan don hang',
    vnp_PayDate: '20261028101500',
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: 'TESTCODE',
    vnp_TransactionNo: '14123456',
    vnp_TransactionStatus: transactionStatus,
    vnp_TxnRef: txnRef,
  });

const lastNotification = (paymentId: number | null) =>
  prisma.paymentNotification.findFirstOrThrow({ where: { paymentId, source: 'RETURN' }, orderBy: { id: 'desc' } });

beforeAll(async () => {
  buyerId = (await prisma.user.create({ data: { name: `${TAG} buyer` } })).id;
  eventId = (
    await prisma.event.create({
      data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
    })
  ).id;
});

// No cleanup: the test database is recreated on every run, and ledger rows can't be deleted anyway.
afterAll(() => prisma.$disconnect());

describe('GET /payments/vnpay/return/:locale', () => {
  it('records a signed success and redirects; the query string itself changes nothing', async () => {
    const { orderId, payment } = await openPayment();

    const res = await request(app).get('/payments/vnpay/return/vi').query(returned(payment.txnRef));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB}/vi/orders/${orderId}`);
    expect(await lastNotification(payment.id)).toMatchObject({
      source: 'RETURN',
      signatureValid: true,
      result: 'REPORTED_SUCCESS',
      payload: expect.objectContaining({ vnp_TxnRef: payment.txnRef, vnp_ResponseCode: '00' }),
    });
    // The query string is never trusted to settle a payment. (Here VNPay cannot be reached, so the
    // querydr fallback fails and the order stays as it was.)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
  });

  it('records a cancelled payment (code 24) as a reported failure', async () => {
    const { payment } = await openPayment();
    await request(app)
      .get('/payments/vnpay/return/vi')
      .query(returned(payment.txnRef, '24', '02'));
    expect((await lastNotification(payment.id)).result).toBe('REPORTED_FAILURE');
  });

  it('does not count ResponseCode 00 alone as success', async () => {
    const { payment } = await openPayment();
    await request(app)
      .get('/payments/vnpay/return/vi')
      .query(returned(payment.txnRef, '00', '01'));
    expect((await lastNotification(payment.id)).result).toBe('REPORTED_FAILURE');
  });

  it('flags a forged or tampered return, still showing the real order status', async () => {
    const { orderId, payment } = await openPayment();
    const forged = { ...returned(payment.txnRef), vnp_Amount: '100' }; // edited after signing

    const res = await request(app).get('/payments/vnpay/return/vi').query(forged);

    expect(res.headers.location).toBe(`${WEB}/vi/orders/${orderId}`);
    expect(await lastNotification(payment.id)).toMatchObject({ signatureValid: false, result: 'INVALID_SIGNATURE' });
  });

  it('sends an unknown reference to the home page and records it without a payment', async () => {
    const res = await request(app).get('/payments/vnpay/return/en').query(returned('unknown-ref-1'));
    expect(res.headers.location).toBe(`${WEB}/en`);
    expect(await lastNotification(null)).toMatchObject({ result: 'UNKNOWN_PAYMENT', signatureValid: true });
  });

  it('keeps the language of the return path, falling back to vi', async () => {
    const { orderId, payment } = await openPayment();
    const en = await request(app).get('/payments/vnpay/return/en').query(returned(payment.txnRef));
    const odd = await request(app).get('/payments/vnpay/return/xx').query(returned(payment.txnRef));
    expect(en.headers.location).toBe(`${WEB}/en/orders/${orderId}`);
    expect(odd.headers.location).toBe(`${WEB}/vi/orders/${orderId}`);
  });

  it('ignores a visit without VNPay parameters', async () => {
    const before = await prisma.paymentNotification.count();
    const res = await request(app).get('/payments/vnpay/return/vi');
    expect(res.headers.location).toBe(`${WEB}/vi`);
    expect(await prisma.paymentNotification.count()).toBe(before);
  });

  it('never redirects outside our web app, whatever the query says', async () => {
    const res = await request(app)
      .get('/payments/vnpay/return/vi')
      .query({ ...returned('unknown-ref-2'), next: 'https://evil.example', redirect: 'https://evil.example' });
    expect(res.headers.location.startsWith(`${WEB}/`)).toBe(true);
  });
});

describe('querydr fallback on return', () => {
  it('asks VNPay when IPN has not arrived, and settles the order from its signed answer', async () => {
    const { orderId, payment } = await openPayment();
    const fetchSpy = mockVnpayQuery({
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: '11000000',
      vnp_TransactionStatus: '00',
    });

    const res = await request(app).get('/payments/vnpay/return/vi').query(returned(payment.txnRef));

    expect(res.headers.location).toBe(`${WEB}/vi/orders/${orderId}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(
      await prisma.paymentNotification.findFirst({ where: { paymentId: payment.id, source: 'QUERY' } }),
    ).toMatchObject({ result: 'SUCCESS_APPLIED', signatureValid: true });
  });

  it('does not ask VNPay when IPN already settled the payment', async () => {
    const { payment } = await openPayment();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerResponseCode: '00', status: 'SUCCEEDED' },
    });
    const fetchSpy = mockVnpayQuery({});

    await request(app).get('/payments/vnpay/return/vi').query(returned(payment.txnRef));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
