import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/prisma';
import { reconcilePayment } from '../../../src/modules/payments/payments.reconcile';
import { queryVnpayTransaction } from '../../../src/modules/payments/vnpay/vnpay.querydr';
import { mockVnpayQuery, TEST_SECRET } from '../../helpers/vnpay';

const app = createApp();
const config = {
  tmnCode: 'TESTCODE',
  hashSecret: TEST_SECRET,
  payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  apiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
};

let buyerId: number;
let eventId: number;

async function openPayment() {
  const seller = await prisma.user.create({ data: { name: '[querydr.test] seller' } });
  const listing = await prisma.listing.create({
    data: { eventId, sellerId: seller.id, unitPrice: 100_000n, quantityTotal: 1, quantityAvailable: 1 },
  });
  const res = await request(app)
    .post('/orders')
    .set('X-User-Id', String(buyerId))
    .send({ listingId: listing.id, quantity: 1 });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
  return { orderId: res.body.order.id as number, listingId: listing.id, payment };
}

const statusOf = async (orderId: number) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

beforeAll(async () => {
  buyerId = (await prisma.user.create({ data: { name: '[querydr.test] buyer' } })).id;
  eventId = (
    await prisma.event.create({
      data: { name: '[querydr.test] event', venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
    })
  ).id;
});

describe('queryVnpayTransaction', () => {
  it('POSTs the request signed over its fields joined by "|" in the documented order', async () => {
    const fetchSpy = mockVnpayQuery({ vnp_TxnRef: 'REF1', vnp_Amount: '100', vnp_TransactionStatus: '00' });

    await queryVnpayTransaction({ txnRef: 'REF1', transactionDate: new Date('2026-10-28T04:02:41Z') }, config);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(config.apiUrl);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: 'REF1',
      vnp_TransactionDate: '20261028110241', // GMT+7
    });
    const data = [
      body.vnp_RequestId,
      body.vnp_Version,
      body.vnp_Command,
      body.vnp_TmnCode,
      body.vnp_TxnRef,
      body.vnp_TransactionDate,
      body.vnp_CreateDate,
      body.vnp_IpAddr,
      body.vnp_OrderInfo,
    ].join('|');
    expect(body.vnp_SecureHash).toBe(createHmac('sha512', TEST_SECRET).update(data).digest('hex'));
  });

  it('rejects an answer that was not signed with our secret', async () => {
    mockVnpayQuery({ vnp_TxnRef: 'REF1', vnp_TransactionStatus: '00' }, 'someone-else');
    await expect(queryVnpayTransaction({ txnRef: 'REF1', transactionDate: new Date() }, config)).rejects.toThrow(
      /invalid signature/,
    );
  });
});

describe('reconcilePayment', () => {
  it('applies a successful answer like an IPN: order PAID and posted to the ledger', async () => {
    const { orderId, payment } = await openPayment();
    mockVnpayQuery({ vnp_TxnRef: payment.txnRef, vnp_Amount: '11000000', vnp_TransactionStatus: '00' });

    expect(await reconcilePayment(payment.id)).toBe('SUCCESS_APPLIED');

    expect(await statusOf(orderId)).toBe('PAID');
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: 'SUCCEEDED',
      providerTransactionNo: '15717032',
    });
    expect(await prisma.ledgerTransaction.count({ where: { orderId, kind: 'PAYMENT_CAPTURED' } })).toBe(1);
  });

  it('a later IPN for the same payment is then answered as already confirmed', async () => {
    const { payment } = await openPayment();
    mockVnpayQuery({ vnp_TxnRef: payment.txnRef, vnp_Amount: '11000000', vnp_TransactionStatus: '00' });
    await reconcilePayment(payment.id);

    expect(await reconcilePayment(payment.id)).toBe('ALREADY_APPLIED'); // no second query either
  });

  it('fails the order and releases the tickets when VNPay reports a failure', async () => {
    const { orderId, listingId, payment } = await openPayment();
    mockVnpayQuery({ vnp_TxnRef: payment.txnRef, vnp_Amount: '11000000', vnp_TransactionStatus: '02' });

    expect(await reconcilePayment(payment.id)).toBe('FAILURE_APPLIED');

    expect(await statusOf(orderId)).toBe('FAILED');
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable).toBe(1);
  });

  it.each([
    ['still processing at VNPay', { vnp_TransactionStatus: '01' }, 'STILL_PENDING'],
    ['never paid at VNPay', { vnp_ResponseCode: '91', vnp_Message: 'Not found' }, 'NOT_FOUND'],
  ])('leaves the order pending when %s', async (_case, fields, outcome) => {
    const { orderId, payment } = await openPayment();
    mockVnpayQuery({ vnp_TxnRef: payment.txnRef, vnp_Amount: '11000000', ...fields });

    expect(await reconcilePayment(payment.id)).toBe(outcome);
    expect(await statusOf(orderId)).toBe('PENDING');
  });

  it('records a failure to reach VNPay and changes nothing', async () => {
    const { orderId, payment } = await openPayment(); // network is blocked in tests

    expect(await reconcilePayment(payment.id)).toBe('QUERY_FAILED');
    expect(await statusOf(orderId)).toBe('PENDING');
    expect(
      await prisma.paymentNotification.findFirst({ where: { paymentId: payment.id, source: 'QUERY' } }),
    ).toMatchObject({
      result: 'QUERY_FAILED',
      signatureValid: false,
    });
  });
});

describe('GET /orders/:id while the buyer waits', () => {
  it('asks VNPay once the buyer has come back, then not again for 10 seconds', async () => {
    const { orderId, payment } = await openPayment();
    await prisma.paymentNotification.create({
      data: { paymentId: payment.id, source: 'RETURN', payload: {}, signatureValid: true, result: 'REPORTED_SUCCESS' },
    });
    const fetchSpy = mockVnpayQuery({
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: '11000000',
      vnp_TransactionStatus: '01',
    });
    const get = () => request(app).get(`/orders/${orderId}`).set('X-User-Id', String(buyerId));

    expect((await get()).body.status).toBe('PENDING');
    await get();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // throttled
  });

  it('does not ask VNPay before the buyer has been there', async () => {
    const { orderId } = await openPayment();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await request(app).get(`/orders/${orderId}`).set('X-User-Id', String(buyerId));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
