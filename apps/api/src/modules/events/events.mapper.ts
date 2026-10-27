import type { EventDetailDto, EventSummaryDto, ListingDto } from '@tc/shared';
import type { Event } from '../../generated/prisma/client';
import { toNumber } from '../../lib/money';
import type { EventWithListings, ListingStats } from './events.service';

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

function toListingDto(listing: EventWithListings['listings'][number]): ListingDto {
  return {
    id: listing.id,
    eventId: listing.eventId,
    seller: listing.seller,
    unitPrice: toNumber(listing.unitPrice),
    quantityAvailable: listing.quantityAvailable,
    quantityTotal: listing.quantityTotal,
    status: listing.status,
  };
}

export function toEventDetailDto(event: EventWithListings): EventDetailDto {
  // Listings are already loaded, so the summary stats come from them rather than another query.
  const stats: ListingStats = {
    minPrice: event.listings[0]?.unitPrice ?? null, // sorted cheapest first
    ticketsAvailable: event.listings.reduce((sum, listing) => sum + listing.quantityAvailable, 0),
  };
  return {
    ...toEventSummaryDto(event, stats),
    description: event.description,
    listings: event.listings.map(toListingDto),
  };
}
