import type { EventSummaryDto } from '@tc/shared';
import type { Event } from '../../generated/prisma/client';
import { toNumber } from '../../lib/money';
import type { ListingStats } from './events.service';

export function toEventSummaryDto(event: Event, stats: ListingStats): EventSummaryDto {
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    city: event.city,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    minPrice: stats.minPrice === null ? null : toNumber(stats.minPrice),
    ticketsAvailable: stats.ticketsAvailable,
  };
}
