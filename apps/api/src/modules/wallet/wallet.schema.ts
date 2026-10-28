import { z } from 'zod';
import { LEDGER_TRANSACTION_KINDS, type BalancesDto, type LedgerLineDto, type Page } from '@tc/shared';
import { pageQuerySchema, pageSchema } from '../../lib/pagination';

export const BalancesSchema = z
  .object({
    pending: z.number().int().meta({ description: 'Seller money held in escrow until the event', example: 617500 }),
    available: z.number().int().meta({ description: 'Seller money released after the event', example: 0 }),
    refundPending: z.number().int().meta({ description: 'Money owed back to this user as a buyer', example: 0 }),
  })
  .meta({ id: 'Balances' }) satisfies z.ZodType<BalancesDto>;

export const LedgerLineSchema = z
  .object({
    id: z.number().int(),
    createdAt: z.iso.datetime(),
    kind: z.enum(LEDGER_TRANSACTION_KINDS),
    account: z.string().meta({ example: 'seller:1:pending' }),
    amount: z.number().int().meta({ description: 'Signed: + debit, − credit', example: -617500 }),
    orderId: z.number().int().nullable(),
    eventId: z.number().int().nullable(),
  })
  .meta({ id: 'LedgerLine' }) satisfies z.ZodType<LedgerLineDto>;

// The last entry id on a page.
export const MyLedgerQuerySchema = pageQuerySchema(z.object({ id: z.number().int() }));

export const LedgerPageSchema = pageSchema(LedgerLineSchema).meta({ id: 'LedgerPage' }) satisfies z.ZodType<
  Page<LedgerLineDto>
>;
