import { z } from 'zod';
import {
  EVENT_STATUSES,
  LISTING_STATUSES,
  type EventDetailDto,
  type EventSummaryDto,
  type ListingDto,
} from '@tc/shared';

export const EventIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().meta({ description: 'Event id', example: 1 }),
});

export const EventSummarySchema = z
  .object({
    id: z.number().int().meta({ example: 1 }),
    name: z.string().meta({ example: 'Hà Nội Indie Night 2026' }),
    venue: z.string().meta({ example: 'Cung Điền kinh Mỹ Đình' }),
    city: z.string().meta({ example: 'Hà Nội' }),
    startsAt: z.iso.datetime(),
    status: z.enum(EVENT_STATUSES),
    minPrice: z
      .number()
      .int()
      .nullable()
      .meta({ description: 'Cheapest ticket on sale, VND. Null when nothing is on sale.', example: 450000 }),
    ticketsAvailable: z.number().int().meta({ description: 'Tickets on sale across all listings', example: 9 }),
  })
  .meta({ id: 'EventSummary' }) satisfies z.ZodType<EventSummaryDto>;

export const ListingSchema = z
  .object({
    id: z.number().int().meta({ example: 1 }),
    eventId: z.number().int().meta({ example: 1 }),
    seller: z.object({ id: z.number().int(), name: z.string() }).meta({ example: { id: 1, name: 'Alice Nguyen' } }),
    unitPrice: z.number().int().meta({ description: 'Price per ticket, VND', example: 450000 }),
    quantityAvailable: z.number().int().meta({ example: 4 }),
    quantityTotal: z.number().int().meta({ example: 4 }),
    status: z.enum(LISTING_STATUSES),
  })
  .meta({ id: 'Listing' }) satisfies z.ZodType<ListingDto>;

export const EventDetailSchema = EventSummarySchema.extend({
  description: z.string(),
  listings: z.array(ListingSchema).meta({
    description: 'Listings on sale, cheapest first. Empty when the event is no longer active.',
  }),
}).meta({ id: 'EventDetail' }) satisfies z.ZodType<EventDetailDto>;
