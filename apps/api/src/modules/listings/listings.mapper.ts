import type { MyListingDto } from '@tc/shared';
import { toNumber } from '../../lib/money';
import type { SellerListing } from './listings.service';

export function toMyListingDto(listing: SellerListing): MyListingDto {
  return {
    id: listing.id,
    event: { ...listing.event, startsAt: listing.event.startsAt.toISOString() },
    unitPrice: toNumber(listing.unitPrice),
    status: listing.status,
    quantityTotal: listing.quantityTotal,
    quantityAvailable: listing.quantityAvailable,
    ticketsReserved: listing.ticketsReserved,
    ticketsSold: listing.ticketsSold,
    createdAt: listing.createdAt.toISOString(),
    withdrawnAt: listing.withdrawnAt?.toISOString() ?? null,
  };
}
