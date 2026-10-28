import { z } from 'zod';
import {
  EVENT_STATUSES,
  LISTING_PRICE_MAX,
  LISTING_PRICE_MIN,
  LISTING_PRICE_STEP,
  LISTING_STATUSES,
  MAX_TICKETS_PER_LISTING,
  type CreateListingInput,
  type MyListingDto,
  type Page,
} from '@tc/shared';
import { pageQuerySchema, pageSchema } from '../../lib/pagination';

export const CreateListingBodySchema = z
  .object({
    eventId: z.number().int().positive().meta({ example: 1 }),
    unitPrice: z
      .number()
      .int()
      .min(LISTING_PRICE_MIN)
      .max(LISTING_PRICE_MAX)
      .multipleOf(LISTING_PRICE_STEP)
      .meta({ description: `VND per ticket, in steps of ${LISTING_PRICE_STEP}`, example: 500000 }),
    quantity: z.number().int().min(1).max(MAX_TICKETS_PER_LISTING).meta({ example: 2 }),
  })
  .meta({ id: 'CreateListingInput' }) satisfies z.ZodType<CreateListingInput>;

export const ListingIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().meta({ description: 'Listing id', example: 1 }),
});

const isoDate = z.iso.datetime();

export const MyListingSchema = z
  .object({
    id: z.number().int(),
    event: z.object({ id: z.number().int(), name: z.string(), startsAt: isoDate, status: z.enum(EVENT_STATUSES) }),
    unitPrice: z.number().int().meta({ example: 500000 }),
    status: z.enum(LISTING_STATUSES),
    quantityTotal: z.number().int(),
    quantityAvailable: z.number().int().meta({ description: 'On sale now' }),
    ticketsReserved: z.number().int().meta({ description: 'Held by orders waiting for payment' }),
    ticketsSold: z.number().int().meta({ description: 'In paid orders' }),
    createdAt: isoDate,
    withdrawnAt: isoDate.nullable(),
  })
  .meta({ id: 'MyListing' }) satisfies z.ZodType<MyListingDto>;

// The last listing id on a page.
export const MyListingsQuerySchema = pageQuerySchema(z.object({ id: z.number().int() }));

export const MyListingPageSchema = pageSchema(MyListingSchema).meta({ id: 'MyListingPage' }) satisfies z.ZodType<
  Page<MyListingDto>
>;
