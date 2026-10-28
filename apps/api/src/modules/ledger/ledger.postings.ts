import { ACCOUNTS } from '../../constants/ledger';
import type { Order } from '../../generated/prisma/client';
import { LedgerTransactionKind } from '../../generated/prisma/enums';
import { credit, debit, type PostingInput } from './ledger.service';

type OrderAmounts = Pick<Order, 'id' | 'subtotal' | 'sellerFee' | 'total'>;

/**
 * Buyer paid for an order we can fulfil. The gateway holds the money for us; we owe the seller
 * their payout (in escrow until the event) and keep our fee as pending, not yet earned.
 * Uses the amounts frozen on the order, never recomputed.
 */
export function paymentCapturedPosting(order: OrderAmounts, sellerId: number): PostingInput {
  const sellerPayout = order.subtotal - order.sellerFee;
  const platformShare = order.total - sellerPayout; // the remainder, so the lines always balance
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
