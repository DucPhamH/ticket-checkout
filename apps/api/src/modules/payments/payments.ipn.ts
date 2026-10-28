import { prisma } from '../../db/prisma';
import type { Prisma } from '../../generated/prisma/client';
import {
  EventStatus,
  ListingStatus,
  OrderStatus,
  PaymentNotificationSource,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { latePaymentPosting, paymentCapturedPosting } from '../ledger/ledger.postings';
import { postTransaction } from '../ledger/ledger.service';
import { IPN_RESPONSE, LATE_PAYMENT_REFUND_REASON, type IpnResponse } from './payments.constants';
import { VNPAY_AMOUNT_MULTIPLIER } from './vnpay/vnpay.constants';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { isVnpaySuccess } from './vnpay/vnpay.result';
import { verifyVnpaySignature, type VnpayParams } from './vnpay/vnpay.signature';

type Outcome = { response: IpnResponse; signatureValid: boolean; paymentId: number | null };

/**
 * VNPay's server-to-server notification: the source of truth for a payment's result.
 *
 * Checks, in VNPay's order: input (99), signature (97), payment exists (01), amount (04),
 * not processed yet (02). Then settles the payment and the order, and posts to the ledger,
 * all in one transaction. Every call is recorded in payment_notifications, whatever happens.
 * An unexpected error answers 99 so VNPay retries later.
 */
export async function handleVnpayIpn(params: VnpayParams): Promise<IpnResponse> {
  let outcome: Outcome;
  try {
    outcome = await processIpn(params);
  } catch (err) {
    logger.error({ err, txnRef: params.vnp_TxnRef }, 'vnpay ipn failed; VNPay will retry');
    outcome = { response: IPN_RESPONSE.unknownError, signatureValid: false, paymentId: null };
  }
  await recordNotification(params, outcome);
  logger.info({ txnRef: params.vnp_TxnRef, rspCode: outcome.response.RspCode }, 'vnpay ipn');
  return outcome.response;
}

async function processIpn(params: VnpayParams): Promise<Outcome> {
  if (!params.vnp_TxnRef || !params.vnp_SecureHash || !params.vnp_Amount) {
    return { response: IPN_RESPONSE.inputRequired, signatureValid: false, paymentId: null };
  }
  if (!verifyVnpaySignature(params, getVnpayConfig().hashSecret)) {
    return { response: IPN_RESPONSE.invalidSignature, signatureValid: false, paymentId: null };
  }

  const found = await prisma.payment.findUnique({
    where: { txnRef: params.vnp_TxnRef },
    select: { id: true, orderId: true },
  });
  if (!found) return { response: IPN_RESPONSE.orderNotFound, signatureValid: true, paymentId: null };

  const response = await prisma.$transaction(async (tx) => {
    // Lock the order, then the payment: the same order the expiry sweep uses, so the two can
    // never wait on each other in a circle. Duplicate IPNs queue here, one at a time.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${found.id} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: found.id },
      include: { order: { include: { listing: { select: { sellerId: true } } } } },
    });

    if (
      !/^\d+$/.test(params.vnp_Amount) ||
      BigInt(params.vnp_Amount) !== payment.amount * BigInt(VNPAY_AMOUNT_MULTIPLIER)
    ) {
      return IPN_RESPONSE.invalidAmount;
    }
    // A gateway result was already applied (an earlier IPN): answer 02 so VNPay stops retrying.
    // (A payment failed by our own expiry sweep has no gateway result yet, so a late success still counts.)
    if (payment.providerResponseCode !== null) return IPN_RESPONSE.alreadyConfirmed;

    const gateway = {
      providerResponseCode: params.vnp_ResponseCode ?? null,
      providerTransactionNo: params.vnp_TransactionNo ?? null,
      providerPayDate: params.vnp_PayDate ?? null,
      bankCode: params.vnp_BankCode ?? null,
    };

    if (isVnpaySuccess(params)) {
      await tx.payment.update({ where: { id: payment.id }, data: { ...gateway, status: PaymentStatus.SUCCEEDED } });
      await settleSuccessfulPayment(tx, payment);
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { ...gateway, status: PaymentStatus.FAILED } });
      await settleFailedPayment(tx, payment.order);
    }
    return IPN_RESPONSE.success;
  });

  return { response, signatureValid: true, paymentId: found.id };
}

type LockedPayment = Prisma.PaymentGetPayload<{
  include: { order: { include: { listing: { select: { sellerId: true } } } } };
}>;

async function settleSuccessfulPayment(tx: Prisma.TransactionClient, payment: LockedPayment) {
  const { order } = payment;

  // Tickets are still held (the order may be past expires_at, but the sweep has not run yet).
  const stillReserved = order.status === OrderStatus.PENDING;
  // The reservation expired and its tickets went back on sale; take them again if still there.
  const reReserved =
    !stillReserved &&
    order.status === OrderStatus.EXPIRED &&
    (
      await tx.listing.updateMany({
        where: {
          id: order.listingId,
          status: ListingStatus.ACTIVE,
          quantityAvailable: { gte: order.quantity },
          event: { status: EventStatus.ACTIVE },
        },
        data: { quantityAvailable: { decrement: order.quantity } },
      })
    ).count === 1;

  if (stillReserved || reReserved) {
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID, paidAt: new Date() } });
    await postTransaction(tx, paymentCapturedPosting(order, order.listing.sellerId));
    return;
  }

  // Paid, but the tickets are gone: never drop real money. Owe it back to the buyer.
  const refund = await tx.refund.create({
    data: { orderId: order.id, paymentId: payment.id, amount: order.total, reason: LATE_PAYMENT_REFUND_REASON },
  });
  await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUND_PENDING } });
  await postTransaction(tx, latePaymentPosting(order, order.buyerId, refund.id));
  logger.warn(
    { orderId: order.id, refundId: refund.id },
    'payment arrived after its tickets were released; refund owed',
  );
}

async function settleFailedPayment(tx: Prisma.TransactionClient, order: LockedPayment['order']) {
  // Only a still-pending order holds tickets; an expired one already released them.
  if (order.status !== OrderStatus.PENDING) return;
  await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
  await tx.listing.update({
    where: { id: order.listingId },
    data: { quantityAvailable: { increment: order.quantity } },
  });
}

// Recorded outside the processing transaction, so it is kept even when processing rolled back.
async function recordNotification(params: VnpayParams, outcome: Outcome) {
  try {
    await prisma.paymentNotification.create({
      data: {
        paymentId: outcome.paymentId,
        source: PaymentNotificationSource.IPN,
        payload: params,
        signatureValid: outcome.signatureValid,
        result: outcome.response.RspCode,
      },
    });
  } catch (err) {
    logger.error({ err, txnRef: params.vnp_TxnRef }, 'could not record vnpay ipn');
  }
}
