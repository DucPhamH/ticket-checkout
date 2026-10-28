import { z } from 'zod';
import { ACCOUNT_TYPES, EVENT_STATUSES, type AdminEventDto, type Page, type TrialBalanceDto } from '@tc/shared';
import { pageQuerySchema, pageSchema } from '../../lib/pagination';

export const TrialBalanceSchema = z
  .object({
    accounts: z.array(
      z.object({
        code: z.string().meta({ example: 'platform:gateway_clearing' }),
        type: z.enum(ACCOUNT_TYPES),
        balance: z.number().int().meta({ description: 'Signed: + debit, − credit', example: 715000 }),
      }),
    ),
    total: z.number().int().meta({ description: 'Sum of all balances; 0 in a healthy ledger', example: 0 }),
  })
  .meta({ id: 'TrialBalance' }) satisfies z.ZodType<TrialBalanceDto>;

const isoDate = z.iso.datetime();

export const AdminEventSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    venue: z.string(),
    startsAt: isoDate,
    status: z.enum(EVENT_STATUSES),
    completedAt: isoDate.nullable(),
    cancelledAt: isoDate.nullable(),
    paidOrders: z.number().int().meta({ description: 'Orders paid for and not refunded', example: 3 }),
    ticketsSold: z.number().int().meta({ example: 4 }),
    paidTotal: z.number().int().meta({ description: 'What buyers paid for them, fees included', example: 2860000 }),
  })
  .meta({ id: 'AdminEvent' }) satisfies z.ZodType<AdminEventDto>;

// The sort key of the last event on a page.
const AdminEventCursorSchema = z.object({ startsAt: isoDate.pipe(z.coerce.date()), id: z.number().int() });
export type AdminEventCursor = z.output<typeof AdminEventCursorSchema>;

export const AdminEventsQuerySchema = pageQuerySchema(AdminEventCursorSchema);

export const AdminEventPageSchema = pageSchema(AdminEventSchema).meta({ id: 'AdminEventPage' }) satisfies z.ZodType<
  Page<AdminEventDto>
>;
