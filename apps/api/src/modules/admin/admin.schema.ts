import { z } from 'zod';
import { ACCOUNT_TYPES, type TrialBalanceDto } from '@tc/shared';

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
