import { z } from 'zod';
import type { BalancesDto } from '@tc/shared';

export const BalancesSchema = z
  .object({
    pending: z.number().int().meta({ description: 'Seller money held in escrow until the event', example: 617500 }),
    available: z.number().int().meta({ description: 'Seller money released after the event', example: 0 }),
    refundPending: z.number().int().meta({ description: 'Money owed back to this user as a buyer', example: 0 }),
  })
  .meta({ id: 'Balances' }) satisfies z.ZodType<BalancesDto>;
