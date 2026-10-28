// Runs on the throwaway test database: these tests post real ledger entries.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/prisma';
import { signVnpayParams } from '../../../src/modules/payments/vnpay/vnpay.signature';

const app = createApp();
const SECRET = 'TEST_SECRET_FOR_UNIT_TESTS_ONLY';
const PAST = () => new Date(Date.now() - 60_000);

let buyerId: number;
let otherBuyerId: number;
let sellerId: number;
let eventId: number;

// A listing priced 500,000 per ticket. One ticket: buyer pays 550,000, seller gets 475,000, we keep 75,000.
async function makeListing(quantity: number) {
  return prisma.listing.create({
    data: { eventId, sellerId, unitPrice: 500_000n, quantityTotal: quantity, quantityAvailable: quantity },
  });
}

async function buy(listingId: number, userId = buyerId) {
  const res = await request(app).post('/orders').set('X-User-Id', String(userId)).send({ listingId, quantity: 1 });
  expect(res.status).toBe(201);
  const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: res.body.order.id } });
  return { orderId: res.body.order.id as number, payment };
}

// The parameters VNPay sends, signed with the merchant secret.
function ipnParams(txnRef: string, amount: bigint, responseCode = '00', transactionStatus = '00', secret = SECRET) {
  const fields: Record<string, string> = {
    vnp_Amount: String(amount * 100n),
    vnp_BankCode: 'NCB',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Thanh toan don hang',
    vnp_PayDate: '20261028103000',
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: 'TESTCODE',
    vnp_TransactionNo: '14999999',
    vnp_TransactionStatus: transactionStatus,
    vnp_TxnRef: txnRef,
  };
  return { ...fields, vnp_SecureHash: signVnpayParams(fields, secret) };
}

const ipn = (params: Record<string, string>) => request(app).get('/payments/vnpay/ipn').query(params);

const orderOf = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
const paymentOf = (id: number) => prisma.payment.findUniqueOrThrow({ where: { id } });
const availableOf = async (listingId: number) =>
  (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable;
const postingsFor = (orderId: number) =>
  prisma.ledgerTransaction.findMany({
    where: { orderId },
    include: { entries: { include: { account: true }, orderBy: { id: 'asc' } } },
  });
const linesOf = (tx: { entries: { amount: bigint; account: { code: string } }[] }) =>
  tx.entries.map((e) => [e.account.code, e.amount]);

beforeAll(async () => {
  buyerId = (await prisma.user.create({ data: { name: '[ipn.test] buyer' } })).id;
  otherBuyerId = (await prisma.user.create({ data: { name: '[ipn.test] other buyer' } })).id;
  sellerId = (await prisma.user.create({ data: { name: '[ipn.test] seller' } })).id;
  eventId = (
    await prisma.event.create({
      data: { name: '[ipn.test] event', venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
    })
  ).id;
});

describe('successful payment', () => {
  it('marks the order PAID, stores the gateway details and posts the capture to the ledger', async () => {
    const listing = await makeListing(2);
    const { orderId, payment } = await buy(listing.id);

    const res = await ipn(ipnParams(payment.txnRef, payment.amount));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await orderOf(orderId)).toMatchObject({ status: 'PAID', paidAt: expect.any(Date) });
    expect(await paymentOf(payment.id)).toMatchObject({
      status: 'SUCCEEDED',
      providerResponseCode: '00',
      providerTransactionNo: '14999999',
      providerPayDate: '20261028103000',
      bankCode: 'NCB',
    });
    const [capture] = await postingsFor(orderId);
    expect(capture.kind).toBe('PAYMENT_CAPTURED');
    expect(linesOf(capture)).toEqual([
      ['platform:gateway_clearing', 550_000n],
      [`seller:${sellerId}:pending`, -475_000n],
      ['platform:fee_pending', -75_000n],
    ]);
    expect(await availableOf(listing.id)).toBe(1); // the ticket stays sold
    expect(
      await prisma.paymentNotification.findFirst({ where: { paymentId: payment.id, source: 'IPN' } }),
    ).toMatchObject({ signatureValid: true, result: '00' });
  });

  it('answers 02 to a repeated IPN and never posts twice', async () => {
    const { orderId, payment } = await buy((await makeListing(1)).id);
    const params = ipnParams(payment.txnRef, payment.amount);

    expect((await ipn(params)).body.RspCode).toBe('00');
    expect((await ipn(params)).body).toEqual({ RspCode: '02', Message: 'Order already confirmed' });
    expect(await postingsFor(orderId)).toHaveLength(1);
  });

  it('handles the same IPN arriving three times at once', async () => {
    const { orderId, payment } = await buy((await makeListing(1)).id);
    const params = ipnParams(payment.txnRef, payment.amount);

    const codes = (await Promise.all([ipn(params), ipn(params), ipn(params)])).map((r) => r.body.RspCode).sort();

    expect(codes).toEqual(['00', '02', '02']);
    expect(await postingsFor(orderId)).toHaveLength(1);
  });

  it('accepts a payment that lands after expires_at but before the sweep released the tickets', async () => {
    const listing = await makeListing(1);
    const { orderId, payment } = await buy(listing.id);
    await prisma.order.update({ where: { id: orderId }, data: { expiresAt: PAST() } });

    expect((await ipn(ipnParams(payment.txnRef, payment.amount))).body.RspCode).toBe('00');
    expect((await orderOf(orderId)).status).toBe('PAID');
    expect(await availableOf(listing.id)).toBe(0);
  });
});

describe('late payment after the reservation expired', () => {
  it('takes the tickets again if they are still on sale', async () => {
    const listing = await makeListing(1);
    const { orderId, payment } = await buy(listing.id);
    await expireNow(orderId, listing.id);

    expect((await ipn(ipnParams(payment.txnRef, payment.amount))).body.RspCode).toBe('00');

    expect((await orderOf(orderId)).status).toBe('PAID');
    expect(await availableOf(listing.id)).toBe(0);
    expect((await postingsFor(orderId)).map((t) => t.kind)).toEqual(['PAYMENT_CAPTURED']);
  });

  it('owes the money back when the tickets were sold to someone else', async () => {
    const listing = await makeListing(1);
    const { orderId, payment } = await buy(listing.id);
    await expireNow(orderId, listing.id);
    await buy(listing.id, otherBuyerId); // someone else takes the released ticket

    expect((await ipn(ipnParams(payment.txnRef, payment.amount))).body.RspCode).toBe('00');

    expect((await orderOf(orderId)).status).toBe('REFUND_PENDING');
    expect((await paymentOf(payment.id)).status).toBe('SUCCEEDED'); // the money did arrive
    expect(await availableOf(listing.id)).toBe(0); // the other buyer keeps their ticket
    const refund = await prisma.refund.findUniqueOrThrow({ where: { orderId } });
    expect(refund).toMatchObject({
      amount: 550_000n,
      status: 'PENDING',
      reason: 'LATE_PAYMENT',
      paymentId: payment.id,
    });
    const [late] = await postingsFor(orderId);
    expect(late).toMatchObject({ kind: 'LATE_PAYMENT', refundId: refund.id });
    expect(linesOf(late)).toEqual([
      ['platform:gateway_clearing', 550_000n],
      [`buyer:${buyerId}:refund_payable`, -550_000n],
    ]);
  });

  // Simulates the sweep: the order expired and its ticket went back on sale.
  async function expireNow(orderId: number, listingId: number) {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'EXPIRED', expiresAt: PAST() } });
    await prisma.payment.update({ where: { orderId }, data: { status: 'FAILED' } });
    await prisma.listing.update({ where: { id: listingId }, data: { quantityAvailable: { increment: 1 } } });
  }
});

describe('failed payment', () => {
  it.each([
    ['cancelled by the buyer', '24', '02'],
    ['wrong OTP too many times', '13', '02'],
    ['ResponseCode 00 but not completed', '00', '01'],
  ])('%s: order FAILED, tickets released at once, nothing posted', async (_case, responseCode, status) => {
    const listing = await makeListing(1);
    const { orderId, payment } = await buy(listing.id);
    expect(await availableOf(listing.id)).toBe(0);

    expect((await ipn(ipnParams(payment.txnRef, payment.amount, responseCode, status))).body.RspCode).toBe('00');

    expect((await orderOf(orderId)).status).toBe('FAILED');
    expect(await paymentOf(payment.id)).toMatchObject({ status: 'FAILED', providerResponseCode: responseCode });
    expect(await availableOf(listing.id)).toBe(1);
    expect(await postingsFor(orderId)).toHaveLength(0);
  });
});

describe('rejected notifications change nothing', () => {
  it('97 for a bad signature', async () => {
    const { orderId, payment } = await buy((await makeListing(1)).id);
    const res = await ipn(ipnParams(payment.txnRef, payment.amount, '00', '00', 'not-the-secret'));
    expect(res.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
    expect((await orderOf(orderId)).status).toBe('PENDING');
    expect(
      await prisma.paymentNotification.findFirst({ where: { source: 'IPN', result: '97' }, orderBy: { id: 'desc' } }),
    ).toMatchObject({
      signatureValid: false,
    });
  });

  it('01 for an unknown reference', async () => {
    expect((await ipn(ipnParams('no-such-ref', 100_000n))).body).toEqual({ RspCode: '01', Message: 'Order not found' });
  });

  it('04 for an amount that does not match the order', async () => {
    const { orderId, payment } = await buy((await makeListing(1)).id);
    const res = await ipn(ipnParams(payment.txnRef, payment.amount - 1n));
    expect(res.body).toEqual({ RspCode: '04', Message: 'invalid amount' });
    expect((await orderOf(orderId)).status).toBe('PENDING');
    expect(await postingsFor(orderId)).toHaveLength(0);
  });

  it('99 when parameters are missing', async () => {
    expect((await ipn({})).body).toEqual({ RspCode: '99', Message: 'Input data required' });
  });
});

describe('ledger stays balanced', () => {
  it('every posting made by these tests sums to zero', async () => {
    const sums = await prisma.ledgerEntry.groupBy({ by: ['transactionId'], _sum: { amount: true } });
    expect(sums.length).toBeGreaterThan(0);
    expect(sums.every((row) => row._sum.amount === 0n)).toBe(true);
  });
});
