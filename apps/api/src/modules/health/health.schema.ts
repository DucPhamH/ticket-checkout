import { z } from 'zod';
import type { HealthResponse } from '@tc/shared';

// `satisfies` ties the documented shape to the shared contract: if one changes, this fails to compile.
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    db: z.enum(['ok', 'down']).meta({ description: 'Whether the database answered' }),
    time: z.iso.datetime().meta({ example: '2026-10-27T03:00:00.000Z' }),
  })
  .meta({ id: 'HealthResponse' }) satisfies z.ZodType<HealthResponse>;
