import { prisma } from '../../db/prisma';
import { EventStatus, ListingStatus } from '../../generated/prisma/enums';

// A listing is on sale when it is active and still has tickets.
export const onSaleListingWhere = {
  status: ListingStatus.ACTIVE,
  quantityAvailable: { gt: 0 },
};

export type ListingStats = { minPrice: bigint | null; ticketsAvailable: number };

// Upcoming events that can still be bought, soonest first, with price and stock per event.
export async function listActiveEvents() {
  const events = await prisma.event.findMany({
    where: { status: EventStatus.ACTIVE },
    orderBy: { startsAt: 'asc' },
  });

  // One aggregate query for all events (GROUP BY event_id), instead of loading every listing.
  const stats = await prisma.listing.groupBy({
    by: ['eventId'],
    where: { ...onSaleListingWhere, eventId: { in: events.map((event) => event.id) } },
    _min: { unitPrice: true },
    _sum: { quantityAvailable: true },
  });
  const statsByEvent = new Map<number, ListingStats>(
    stats.map((row) => [
      row.eventId,
      { minPrice: row._min.unitPrice, ticketsAvailable: row._sum.quantityAvailable ?? 0 },
    ]),
  );

  return events.map((event) => ({
    event,
    stats: statsByEvent.get(event.id) ?? { minPrice: null, ticketsAvailable: 0 },
  }));
}
