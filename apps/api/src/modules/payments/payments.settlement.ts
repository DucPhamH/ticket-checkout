import { prisma } from '../../db/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { EventStatus, ListingStatus, OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { latePaymentPosting, paymentCapturedPosting } from '../ledger/ledger.postings';
import { postTransaction } from '../ledger/ledger.service';
import { LATE_PAYMENT_REFUND_REASON } from './payments.constants';
import { VNPAY_AMOUNT_MULTIPLIER } from './vnpay/vnpay.constants';

// A payment outcome reported by the gateway, from IPN or from our own query (querydr).
export type GatewayResult = {
  success: boolean;
  amount: string; // as VNPay sends it: VND × 100
  responseCode: string | null; // what decided the outcome (IPN: vnp_ResponseCode, querydr: vnp_TransactionStatus)
  transactionNo: string | null;
  payDate: string | null;
  bankCode: string | null;
};

export type SettlementOutcome = 'applied' | 'alreadyApplied' | 'amountMismatch';

/**
 * Applies a gateway result to a payment and its order, and posts to the ledger, in one transaction.
 * The single place payment results are applied, whether they come from IPN or querydr, so both
 * paths behave identically and can never apply the same result twice.
 */
export async function settleGatewayResult(
  target: { paymentId: number; orderId: number },
  result: GatewayResult,
): Promise<SettlementOutcome> {
  return prisma.$transaction(async (tx) => {
    // Lock the order, then the payment: the same order the expiry sweep uses, so the two can never
    // wait on each other in a circle. Concurrent results for one payment queue here.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${target.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${target.paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: target.paymentId },
      include: { order: { include: { listing: { select: { sellerId: true } } } } },
    });

    if (!/^\d+$/.test(result.amount) || BigInt(result.amount) !== payment.amount * BigInt(VNPAY_AMOUNT_MULTIPLIER)) {
      return 'amountMismatch';
    }
    // A gateway result was already applied. (A payment failed by our own expiry sweep has none yet,
    // so a late success still counts.)
    if (payment.providerResponseCode !== null) return 'alreadyApplied';

    const gateway = {
      providerResponseCode: result.responseCode,
      providerTransactionNo: result.transactionNo,
      providerPayDate: result.payDate,
      bankCode: result.bankCode,
    };
    if (result.success) {
      await tx.payment.update({ where: { id: payment.id }, data: { ...gateway, status: PaymentStatus.SUCCEEDED } });
      await settleSuccessfulPayment(tx, payment);
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { ...gateway, status: PaymentStatus.FAILED } });
      await settleFailedPayment(tx, payment.order);
    }
    return 'applied';
  });
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
