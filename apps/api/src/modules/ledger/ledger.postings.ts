import { ACCOUNTS } from '../../constants/ledger';
import type { Order } from '../../generated/prisma/client';
import { LedgerTransactionKind } from '../../generated/prisma/enums';
import { credit, debit, type PostingInput } from './ledger.service';

type OrderAmounts = Pick<Order, 'id' | 'subtotal' | 'sellerFee' | 'total'>;

// Who an order's money belongs to. The platform's share is the remainder, so the parts always add
// up to exactly what the buyer paid.
export function splitOrderTotal(order: OrderAmounts) {
  const sellerPayout = order.subtotal - order.sellerFee;
  return { sellerPayout, platformShare: order.total - sellerPayout };
}

/**
 * Buyer paid for an order we can fulfil. The gateway holds the money for us; we owe the seller
 * their payout (in escrow until the event) and keep our fee as pending, not yet earned.
 * Uses the amounts frozen on the order, never recomputed.
 */
export function paymentCapturedPosting(order: OrderAmounts, sellerId: number): PostingInput {
  const { sellerPayout, platformShare } = splitOrderTotal(order);
  return {
    kind: LedgerTransactionKind.PAYMENT_CAPTURED,
    idempotencyKey: `capture:order:${order.id}`,
    orderId: order.id,
    lines: [
      debit(ACCOUNTS.gatewayClearing, order.total),
      credit(ACCOUNTS.sellerPending(sellerId), sellerPayout),
      credit(ACCOUNTS.feePending, platformShare),
    ],
  };
}

/**
 * Buyer paid, but the reservation had expired and the tickets were gone. The money is real, so it
 * is recorded, and owed back to the buyer in full until the refund goes through.
 */
export function latePaymentPosting(
  order: Pick<Order, 'id' | 'total'>,
  buyerId: number,
  refundId: number,
): PostingInput {
  return {
    kind: LedgerTransactionKind.LATE_PAYMENT,
    idempotencyKey: `late:order:${order.id}`,
    orderId: order.id,
    refundId,
    lines: [debit(ACCOUNTS.gatewayClearing, order.total), credit(ACCOUNTS.buyerRefundPayable(buyerId), order.total)],
  };
}

/**
 * The event took place: release one order's escrow. The seller's payout becomes available and our
 * fee becomes earned revenue. One posting per order, so settling an event twice changes nothing.
 */
export function eventSettledPosting(order: OrderAmounts, sellerId: number, eventId: number): PostingInput {
  const { sellerPayout, platformShare } = splitOrderTotal(order);
  return {
    kind: LedgerTransactionKind.EVENT_SETTLED,
    idempotencyKey: `settle:order:${order.id}`,
    orderId: order.id,
    eventId,
    lines: [
      debit(ACCOUNTS.sellerPending(sellerId), sellerPayout),
      credit(ACCOUNTS.sellerAvailable(sellerId), sellerPayout),
      debit(ACCOUNTS.feePending, platformShare),
      credit(ACCOUNTS.feeRevenue, platformShare),
    ],
  };
}

/**
 * VNPay refunded the buyer: the money we owed them leaves the gateway. Closes what LATE_PAYMENT or
 * ORDER_CANCELLED put in their refund_payable account.
 */
export function refundCompletedPosting(
  refund: { id: number; orderId: number; amount: bigint },
  buyerId: number,
): PostingInput {
  return {
    kind: LedgerTransactionKind.REFUND_COMPLETED,
    idempotencyKey: `refund:${refund.id}`,
    orderId: refund.orderId,
    refundId: refund.id,
    lines: [
      debit(ACCOUNTS.buyerRefundPayable(buyerId), refund.amount),
      credit(ACCOUNTS.gatewayClearing, refund.amount),
    ],
  };
}

/**
 * The event was cancelled: a paid order's money comes out of escrow (the seller's payout and our
 * not-yet-earned fee) and is owed back to the buyer in full, until VNPay refunds it.
 */
export function orderCancelledPosting(
  order: OrderAmounts,
  parties: { sellerId: number; buyerId: number; eventId: number; refundId: number },
): PostingInput {
  const { sellerPayout, platformShare } = splitOrderTotal(order);
  return {
    kind: LedgerTransactionKind.ORDER_CANCELLED,
    idempotencyKey: `cancel:order:${order.id}`,
    orderId: order.id,
    eventId: parties.eventId,
    refundId: parties.refundId,
    lines: [
      debit(ACCOUNTS.sellerPending(parties.sellerId), sellerPayout),
      debit(ACCOUNTS.feePending, platformShare),
      credit(ACCOUNTS.buyerRefundPayable(parties.buyerId), order.total),
    ],
  };
}
