import { prisma } from '../../db/prisma';
import { EventStatus, OrderStatus } from '../../generated/prisma/enums';
import { HttpError } from '../../lib/http-error';
import { logger } from '../../lib/logger';
import { orderCancelledPosting } from '../ledger/ledger.postings';
import { postTransaction } from '../ledger/ledger.service';
import { EVENT_CANCELLED_REFUND_REASON } from '../payments/payments.constants';
import { processRefund } from '../payments/payments.refund';
import { lockEvent } from './event-lock';

export type CancellationResult = {
  eventId: number;
  cancelledAt: Date;
  cancelledOrders: number; // paid orders cancelled by this call (0 if it had already been done)
  refundsSucceeded: number;
  refundsFailed: number; // left for an admin to retry
};

/**
 * Cancels an event and refunds every paid order.
 *
 * 1. In one transaction, with the event row locked exclusively (see event-lock.ts): the event
 *    becomes CANCELLED and each PAID order becomes REFUND_PENDING with a refund to send. Its money
 *    comes out of escrow and is owed to the buyer (ORDER_CANCELLED).
 * 2. After the commit, each refund is sent to VNPay. A failure does not undo the cancellation:
 *    the refund stays FAILED, visible to the admin, and can be retried.
 *
 * A payment that lands after the cancellation is refunded too (reason EVENT_ENDED). Only an event
 * that has not started can be cancelled: once it starts it is completed instead, and a completed
 * event's escrow has already been released to the sellers.
 */
export async function cancelEvent(eventId: number, createdBy: string): Promise<CancellationResult> {
  const { cancelledAt, refundIds } = await prisma.$transaction(async (tx) => {
    const status = await lockEvent(tx, eventId, 'update');
    if (status === null) throw HttpError.notFound('EVENT_NOT_FOUND', `No event with id ${eventId}`);
    if (status === EventStatus.COMPLETED) {
      throw HttpError.conflict('EVENT_COMPLETED', 'A completed event cannot be cancelled');
    }
    const current = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    if (status === EventStatus.ACTIVE && current.startsAt <= new Date()) {
      throw HttpError.conflict('EVENT_STARTED', 'An event that has started cannot be cancelled; complete it instead');
    }

    const event =
      status === EventStatus.CANCELLED
        ? current
        : await tx.event.update({
            where: { id: eventId },
            data: { status: EventStatus.CANCELLED, cancelledAt: new Date() },
          });

    const orders = await tx.order.findMany({
      where: { status: OrderStatus.PAID, listing: { eventId } },
      include: { listing: { select: { sellerId: true } }, payment: { select: { id: true } } },
      orderBy: { id: 'asc' },
    });

    const refundIds: number[] = [];
    for (const order of orders) {
      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: order.payment!.id,
          amount: order.total,
          reason: EVENT_CANCELLED_REFUND_REASON,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUND_PENDING } });
      await postTransaction(
        tx,
        orderCancelledPosting(order, {
          sellerId: order.listing.sellerId,
          buyerId: order.buyerId,
          eventId,
          refundId: refund.id,
        }),
      );
      refundIds.push(refund.id);
    }
    return { cancelledAt: event.cancelledAt!, refundIds };
  });

  // One at a time: a slow gateway delays the answer, but never sends the same refund twice.
  let refundsSucceeded = 0;
  for (const refundId of refundIds) {
    if ((await processRefund(refundId, createdBy)) === 'SUCCEEDED') refundsSucceeded++;
  }

  const result = {
    eventId,
    cancelledAt,
    cancelledOrders: refundIds.length,
    refundsSucceeded,
    refundsFailed: refundIds.length - refundsSucceeded,
  };
  logger.info(result, 'event cancelled');
  return result;
}
