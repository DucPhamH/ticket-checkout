import { z } from 'zod';
import { EVENT_STATUSES, type EventSummaryDto } from '@tc/shared';

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
