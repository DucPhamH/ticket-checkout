import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  EVENT_STATUSES,
  REFUND_STATUSES,
  type AdminEventDto,
  type CancelEventResultDto,
  type CompleteEventResultDto,
  type Page,
  type RefundDto,
  type TrialBalanceDto,
} from '@tc/shared';
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

export const CompleteEventResultSchema = z
  .object({
    eventId: z.number().int(),
    completedAt: isoDate,
    settledOrders: z
      .number()
      .int()
      .meta({ description: 'Settled by this request; 0 if already completed', example: 2 }),
    sellerPayouts: z.number().int().meta({ description: 'Moved from sellers’ pending to available', example: 1472500 }),
    platformRevenue: z.number().int().meta({ description: 'Fees earned by this request', example: 237500 }),
  })
  .meta({ id: 'CompleteEventResult' }) satisfies z.ZodType<CompleteEventResultDto>;

export const RefundIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().meta({ description: 'Refund id', example: 1 }),
});

export const RefundSchema = z
  .object({
    id: z.number().int(),
    orderId: z.number().int(),
    buyer: z.object({ id: z.number().int(), name: z.string() }),
    event: z.object({ id: z.number().int(), name: z.string() }),
    amount: z.number().int().meta({ description: 'VND, the full order total', example: 715000 }),
    status: z.enum(REFUND_STATUSES),
    reason: z.string().meta({ example: 'EVENT_CANCELLED' }),
    attempts: z.number().int(),
    lastError: z.string().nullable(),
    createdAt: isoDate,
    completedAt: isoDate.nullable(),
  })
  .meta({ id: 'Refund' }) satisfies z.ZodType<RefundDto>;

export const RefundsQuerySchema = pageQuerySchema(z.object({ id: z.number().int() }));

export const RefundPageSchema = pageSchema(RefundSchema).meta({ id: 'RefundPage' }) satisfies z.ZodType<
  Page<RefundDto>
>;

export const CancelEventResultSchema = z
  .object({
    eventId: z.number().int(),
    cancelledAt: isoDate,
    cancelledOrders: z.number().int().meta({ description: 'Paid orders cancelled by this request', example: 2 }),
    refundsSucceeded: z.number().int().meta({ example: 2 }),
    refundsFailed: z.number().int().meta({ description: 'Still owed; retry from the refunds list', example: 0 }),
  })
  .meta({ id: 'CancelEventResult' }) satisfies z.ZodType<CancelEventResultDto>;
