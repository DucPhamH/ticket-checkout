import { prisma } from '../../db/prisma';
import { PaymentNotificationSource } from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { settleGatewayResult } from './payments.settlement';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { queryVnpayTransaction, type QueryDrResponse } from './vnpay/vnpay.querydr';

// What reconciling one payment concluded; stored as payment_notifications.result (source QUERY).
export type ReconcileOutcome =
  | 'SUCCESS_APPLIED'
  | 'FAILURE_APPLIED'
  | 'STILL_PENDING' // VNPay is still processing (01)
  | 'NOT_FOUND' // the buyer never completed a payment at VNPay (91)
  | 'ALREADY_APPLIED'
  | 'AMOUNT_MISMATCH'
  | 'QUERY_FAILED';

// Don't ask VNPay about the same payment more often than this (the order page polls every 3 s).
const QUERY_COOLDOWN_MS = 10_000;

/**
 * Asks VNPay for a payment's result and applies it exactly like an IPN would. The safety net for
 * when IPN is late or never delivered. Never throws: failures are logged and recorded.
 */
export async function reconcilePayment(paymentId: number): Promise<ReconcileOutcome> {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { order: { select: { id: true, createdAt: true } } },
  });
  if (payment.providerResponseCode !== null) return 'ALREADY_APPLIED'; // nothing to ask

  let response: QueryDrResponse | null = null;
  let outcome: ReconcileOutcome;
  try {
    response = await queryVnpayTransaction(
      { txnRef: payment.txnRef, transactionDate: payment.order.createdAt },
      getVnpayConfig(),
    );
    outcome = await applyQueryResult({ paymentId: payment.id, orderId: payment.order.id }, response);
  } catch (err) {
    logger.error({ err, paymentId }, 'vnpay querydr failed');
    outcome = 'QUERY_FAILED';
  }

  await prisma.paymentNotification.create({
    data: {
      paymentId: payment.id,
      source: PaymentNotificationSource.QUERY,
      payload: response ?? {},
      signatureValid: response !== null,
      result: outcome,
    },
  });
  logger.info({ paymentId, txnRef: payment.txnRef, outcome }, 'vnpay querydr');
  return outcome;
}

async function applyQueryResult(
  target: { paymentId: number; orderId: number },
  response: QueryDrResponse,
): Promise<ReconcileOutcome> {
  if (response.vnp_ResponseCode === '91') return 'NOT_FOUND';
  if (response.vnp_ResponseCode !== '00') throw new Error(`querydr ResponseCode ${response.vnp_ResponseCode}`);

  // For querydr, vnp_ResponseCode is the query's own result; the payment's is vnp_TransactionStatus.
  const status = response.vnp_TransactionStatus;
  if (status === '01') return 'STILL_PENDING';

  const settled = await settleGatewayResult(target, {
    success: status === '00',
    amount: response.vnp_Amount ?? '',
    responseCode: status ?? null,
    transactionNo: response.vnp_TransactionNo ?? null,
    payDate: response.vnp_PayDate ?? null,
    bankCode: response.vnp_BankCode ?? null,
  });
  if (settled === 'alreadyApplied') return 'ALREADY_APPLIED';
  if (settled === 'amountMismatch') return 'AMOUNT_MISMATCH';
  return status === '00' ? 'SUCCESS_APPLIED' : 'FAILURE_APPLIED';
}

/**
 * Called while the buyer waits on the order page: reconciles a still-pending order only if the buyer
 * already came back from VNPay (so a payment attempt happened) and we have not asked VNPay recently.
 */
export async function reconcileIfDue(orderId: number): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      id: true,
      providerResponseCode: true,
      order: { select: { status: true } },
      notifications: {
        where: { source: { in: [PaymentNotificationSource.RETURN, PaymentNotificationSource.QUERY] } },
        orderBy: { receivedAt: 'desc' },
        select: { source: true, receivedAt: true },
      },
    },
  });
  if (!payment || payment.providerResponseCode !== null || payment.order.status !== 'PENDING') return;

  const returned = payment.notifications.some((n) => n.source === PaymentNotificationSource.RETURN);
  const lastQuery = payment.notifications.find((n) => n.source === PaymentNotificationSource.QUERY);
  if (!returned || (lastQuery && Date.now() - lastQuery.receivedAt.getTime() < QUERY_COOLDOWN_MS)) return;

  await reconcilePayment(payment.id);
}
