import type { CreateListingInput } from '@tc/shared';
import { prisma } from '../../db/prisma';
import type { Prisma, User } from '../../generated/prisma/client';
import { EventStatus, ListingStatus, OrderStatus, UserRole } from '../../generated/prisma/enums';
import { HttpError } from '../../lib/http-error';
import { lockEvent } from '../events/event-lock';

const listingInclude = { event: { select: { id: true, name: true, startsAt: true, status: true } } } as const;
type ListingWithEvent = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

export type TicketCounts = { ticketsReserved: number; ticketsSold: number };
export type SellerListing = ListingWithEvent & TicketCounts;

/**
 * Puts tickets on sale. The event must still be on sale and not started yet. Locks the event
 * (shared), like buying does, so a listing never appears on an event being completed or cancelled.
 */
export async function createListing(seller: User, input: CreateListingInput): Promise<SellerListing> {
  if (seller.role === UserRole.ADMIN) {
    throw HttpError.forbidden('ADMIN_CANNOT_SELL', 'Admin accounts cannot sell tickets');
  }

  const listing = await prisma.$transaction(async (tx) => {
    const status = await lockEvent(tx, input.eventId, 'share');
    if (status === null) throw HttpError.notFound('EVENT_NOT_FOUND', `No event with id ${input.eventId}`);
    const event = await tx.event.findUniqueOrThrow({ where: { id: input.eventId }, select: { startsAt: true } });
    if (status !== EventStatus.ACTIVE || event.startsAt <= new Date()) {
      throw HttpError.conflict('EVENT_NOT_ON_SALE', 'This event no longer accepts listings');
    }

    return tx.listing.create({
      data: {
        eventId: input.eventId,
        sellerId: seller.id,
        unitPrice: BigInt(input.unitPrice),
        quantityTotal: input.quantity,
        quantityAvailable: input.quantity,
      },
      include: listingInclude,
    });
  });
  return { ...listing, ticketsReserved: 0, ticketsSold: 0 };
}

/**
 * Takes a listing off sale. Its unsold tickets are simply no longer offered; orders already
 * holding tickets keep them and can still be paid. Withdrawing twice is harmless.
 * Someone else's listing answers "not found", so listing ids cannot be probed.
 */
export async function withdrawListing(sellerId: number, listingId: number): Promise<SellerListing> {
  // A single conditional UPDATE: a buyer reserving at the same moment either got their tickets
  // first, or finds the listing withdrawn.
  await prisma.listing.updateMany({
    where: { id: listingId, sellerId, status: ListingStatus.ACTIVE },
    data: { status: ListingStatus.WITHDRAWN, withdrawnAt: new Date() },
  });
  const listing = await prisma.listing.findFirst({ where: { id: listingId, sellerId }, include: listingInclude });
  if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', `No listing with id ${listingId}`);
  return { ...listing, ...(await ticketCounts([listing.id])).get(listing.id)! };
}

/** One page of a seller's listings, newest first (keyset on id), with what each has sold. */
export async function listSellerListings(sellerId: number, page: { limit: number; afterId?: number }) {
  const listings = await prisma.listing.findMany({
    where: { sellerId, ...(page.afterId !== undefined && { id: { lt: page.afterId } }) },
    orderBy: { id: 'desc' },
    take: page.limit + 1, // one extra row tells the caller another page exists
    include: listingInclude,
  });
  const counts = await ticketCounts(listings.map((listing) => listing.id));
  return listings.map((listing): SellerListing => ({ ...listing, ...counts.get(listing.id)! }));
}

// Tickets in waiting and in paid orders per listing, in one query.
async function ticketCounts(listingIds: number[]): Promise<Map<number, TicketCounts>> {
  const rows = await prisma.order.groupBy({
    by: ['listingId', 'status'],
    where: { listingId: { in: listingIds }, status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
    _sum: { quantity: true },
  });
  const counts = new Map(listingIds.map((id): [number, TicketCounts] => [id, { ticketsReserved: 0, ticketsSold: 0 }]));
  for (const row of rows) {
    const count = counts.get(row.listingId)!;
    if (row.status === OrderStatus.PENDING) count.ticketsReserved = row._sum.quantity ?? 0;
    else count.ticketsSold = row._sum.quantity ?? 0;
  }
  return counts;
}
