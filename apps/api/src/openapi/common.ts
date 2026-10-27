import { z } from 'zod';
import type { ZodOpenApiResponseObject } from 'zod-openapi';
import type { ApiErrorBody } from '@tc/shared';

// The single error shape every endpoint returns (see middlewares/error-handler.ts).
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ description: 'Stable, machine-readable code', example: 'LISTING_SOLD_OUT' }),
      message: z.string().meta({ description: 'Human-readable detail for logs', example: 'Only 1 ticket left' }),
    }),
  })
  .meta({ id: 'ErrorResponse' }) satisfies z.ZodType<ApiErrorBody>;

export function jsonResponse(description: string, schema: z.ZodType): ZodOpenApiResponseObject {
  return { description, content: { 'application/json': { schema } } };
}

export const errorResponse = (description: string) => jsonResponse(description, ErrorResponseSchema);
