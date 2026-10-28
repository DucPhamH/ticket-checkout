import { prisma } from '../../db/prisma';
import { Prisma } from '../../generated/prisma/client';
import { toPage } from '../../lib/pagination';
import { toAdminEventDto } from './admin.mapper';
import type { AdminEventCursor } from './admin.schema';

export type EventSales = { paidOrders: number; ticketsSold: number; paidTotal: bigint };
const NO_SALES: EventSales = { paidOrders: 0, ticketsSold: 0, paidTotal: 0n };

/**
 * One page of all events (any status), soonest first, each with its paid sales.
 * Keyset pagination on (starts_at, id).
 */
export async function listEventsForAdmin(page: { limit: number; cursor?: AdminEventCursor }) {
  const { limit, cursor } = page;
  const events = await prisma.event.findMany({
    where: cursor && {
      OR: [{ startsAt: { gt: cursor.startsAt } }, { startsAt: cursor.startsAt, id: { gt: cursor.id } }],
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  // Paid sales per event in one query (orders reach their event through the listing).
  const ids = events.map((event) => event.id);
  const rows =
    ids.length === 0
      ? []
      : await prisma.$queryRaw<({ eventId: number } & EventSales)[]>`
          SELECT l.event_id AS "eventId", COUNT(*)::int AS "paidOrders",
                 SUM(o.quantity)::int AS "ticketsSold", SUM(o.total)::bigint AS "paidTotal"
          FROM orders o
          JOIN listings l ON l.id = o.listing_id
          WHERE o.status = 'PAID' AND l.event_id IN (${Prisma.join(ids)})
          GROUP BY l.event_id
        `;
  const sales = new Map(rows.map(({ eventId, ...row }) => [eventId, row]));

  return toPage(
    events,
    limit,
    (event) => toAdminEventDto(event, sales.get(event.id) ?? NO_SALES),
    (event) => ({ startsAt: event.startsAt.toISOString(), id: event.id }),
  );
}
