import { calculateOrderAmounts, type CreateOrderInput } from '@tc/shared';
import { RESERVATION_MINUTES } from '../../constants/orders';
import { prisma } from '../../db/prisma';
import type { User } from '../../generated/prisma/client';
import { EventStatus, ListingStatus, UserRole } from '../../generated/prisma/enums';
import { HttpError } from '../../lib/http-error';
import { toNumber } from '../../lib/money';
import { toPage } from '../../lib/pagination';
import { createPaymentForOrder } from '../payments/payments.service';
import { lockEvent } from '../events/event-lock';
import { expireStaleOrders } from './order-expiry';
import { toOrderDto } from './orders.mapper';
import type { OrderCursor } from './orders.schema';

// What every order read needs for its DTO: event and seller via the listing.
export const orderInclude = {
  listing: {
    include: {
      event: { select: { id: true, name: true, venue: true, startsAt: true } },
      seller: { select: { id: true, name: true } },
    },
  },
  payment: { select: { providerResponseCode: true } },
} as const;

/**
 * Creates a PENDING order with its PENDING payment and reserves the tickets, all in one transaction.
 *
 * The reservation is a single conditional UPDATE (`... WHERE quantity_available >= n`).
 * Postgres locks the listing row while updating it, so two buyers racing for the last
 * ticket are serialised: the second one re-checks the condition after the first commits,
 * matches 0 rows, and gets NOT_ENOUGH_TICKETS. Reading the stock first and writing it back
 * from application code would let both succeed.
 */
export async function createOrder(buyer: User, input: CreateOrderInput) {
  if (buyer.role === UserRole.ADMIN) {
    throw HttpError.forbidden('ADMIN_CANNOT_BUY', 'Admin accounts cannot buy tickets');
  }

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', `No listing with id ${input.listingId}`);
    if (listing.sellerId === buyer.id) throw HttpError.conflict('OWN_LISTING', 'You cannot buy your own listing');
    // Shared lock: the event cannot be completed or cancelled while this order is being created.
    const eventStatus = await lockEvent(tx, listing.eventId, 'share');
    if (listing.status !== ListingStatus.ACTIVE || eventStatus !== EventStatus.ACTIVE) {
      throw HttpError.conflict('LISTING_NOT_ON_SALE', 'This listing is no longer on sale');
    }

    // Tickets held by an unpaid order past its reservation belong back on sale before we check stock.
    await expireStaleOrders(tx, { listingId: listing.id });

    // The checks above give friendly errors; this UPDATE is what actually guarantees no overselling.
    const reserved = await tx.listing.updateMany({
      where: { id: listing.id, status: ListingStatus.ACTIVE, quantityAvailable: { gte: input.quantity } },
      data: { quantityAvailable: { decrement: input.quantity } },
    });
    if (reserved.count === 0) {
      // Either sold out, or the seller withdrew the listing a moment ago.
      const { status } = await tx.listing.findUniqueOrThrow({ where: { id: listing.id }, select: { status: true } });
      if (status !== ListingStatus.ACTIVE) {
        throw HttpError.conflict('LISTING_NOT_ON_SALE', 'This listing is no longer on sale');
      }
      throw HttpError.conflict('NOT_ENOUGH_TICKETS', `Fewer than ${input.quantity} tickets left`);
    }

    // Same function the checkout UI uses to show the total, so the buyer is charged what they saw.
    const amounts = calculateOrderAmounts(toNumber(listing.unitPrice), input.quantity);

    const order = await tx.order.create({
      data: {
        buyerId: buyer.id,
        listingId: listing.id,
        quantity: input.quantity,
        unitPrice: listing.unitPrice,
        subtotal: BigInt(amounts.subtotal),
        buyerFee: BigInt(amounts.buyerFee),
        sellerFee: BigInt(amounts.sellerFee),
        total: BigInt(amounts.total),
        expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
      },
      include: orderInclude,
    });

    // Same transaction: an order never exists without its payment, and vice versa.
    const payment = await createPaymentForOrder(tx, order);
    return { order, payment };
  });
}

// Only the buyer can see an order. Anyone else gets "not found" rather than "forbidden",
// so order ids cannot be probed. An order past its reservation is expired on read, so the
// buyer sees EXPIRED immediately instead of waiting for the next background sweep.
export function findOrderForBuyer(orderId: number, buyerId: number) {
  return prisma.$transaction(async (tx) => {
    await expireStaleOrders(tx, { orderId });
    return tx.order.findFirst({ where: { id: orderId, buyerId }, include: orderInclude });
  });
}

export type OrderWithDetails = NonNullable<Awaited<ReturnType<typeof findOrderForBuyer>>>;

/**
 * One page of a buyer's orders, newest first. Keyset pagination on (created_at, id), which the
 * (buyer_id, created_at DESC) index serves; id breaks ties between orders created in the same ms.
 * Stale reservations are expired first, so the list never shows a dead order as PENDING.
 */
export async function listOrdersForBuyer(buyerId: number, page: { limit: number; cursor?: OrderCursor }) {
  const { limit, cursor } = page;
  const rows = await prisma.$transaction(async (tx) => {
    await expireStaleOrders(tx, { buyerId });
    return tx.order.findMany({
      where: {
        buyerId,
        ...(cursor && {
          OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: orderInclude,
    });
  });
  return toPage(rows, limit, toOrderDto, (order) => ({ createdAt: order.createdAt.toISOString(), id: order.id }));
}
