import { prisma } from '../../db/prisma';
import { EventStatus, OrderStatus } from '../../generated/prisma/enums';
import { HttpError } from '../../lib/http-error';
import { logger } from '../../lib/logger';
import { eventSettledPosting, splitOrderTotal } from '../ledger/ledger.postings';
import { postTransaction } from '../ledger/ledger.service';
import { lockEvent } from './event-lock';

export type CompletionResult = {
  eventId: number;
  completedAt: Date;
  settledOrders: number; // settled by this call (0 if it had already been done)
  sellerPayouts: bigint; // released to sellers by this call
  platformRevenue: bigint; // fees earned by this call
};

/**
 * Marks an event as having taken place and releases its escrow: for every PAID order, the seller's
 * payout moves from pending to available and our fee from pending to revenue. All in one transaction.
 *
 * The event row is locked exclusively first. Buying a ticket and applying a payment take a shared
 * lock on it, so none can run in between: an order is either PAID before we read the orders (and
 * is settled here), or its payment arrives after the event is COMPLETED (and is refunded).
 *
 * Idempotent: calling it again for a completed event settles nothing new and returns zeros.
 */
export async function completeEvent(eventId: number): Promise<CompletionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const status = await lockEvent(tx, eventId, 'update');
    if (status === null) throw HttpError.notFound('EVENT_NOT_FOUND', `No event with id ${eventId}`);
    if (status === EventStatus.CANCELLED) {
      throw HttpError.conflict('EVENT_CANCELLED', 'A cancelled event cannot be completed');
    }

    const event =
      status === EventStatus.COMPLETED
        ? await tx.event.findUniqueOrThrow({ where: { id: eventId } })
        : await tx.event.update({
            where: { id: eventId },
            data: { status: EventStatus.COMPLETED, completedAt: new Date() },
          });

    const orders = await tx.order.findMany({
      where: { status: OrderStatus.PAID, listing: { eventId } },
      include: { listing: { select: { sellerId: true } } },
      orderBy: { id: 'asc' },
    });

    let settledOrders = 0;
    let sellerPayouts = 0n;
    let platformRevenue = 0n;
    for (const order of orders) {
      const { created } = await postTransaction(tx, eventSettledPosting(order, order.listing.sellerId, eventId));
      if (!created) continue; // settled by an earlier call
      const split = splitOrderTotal(order);
      settledOrders++;
      sellerPayouts += split.sellerPayout;
      platformRevenue += split.platformShare;
    }

    return { eventId, completedAt: event.completedAt!, settledOrders, sellerPayouts, platformRevenue };
  });

  logger.info(
    { ...result, sellerPayouts: String(result.sellerPayouts), platformRevenue: String(result.platformRevenue) },
    'event completed',
  );
  return result;
}
