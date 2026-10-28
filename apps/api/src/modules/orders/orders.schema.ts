import { z } from 'zod';
import {
  MAX_TICKETS_PER_ORDER,
  ORDER_STATUSES,
  SUPPORTED_LOCALES,
  type CreateOrderInput,
  type CreateOrderResponse,
  type OrderDto,
} from '@tc/shared';

export const CreateOrderBodySchema = z
  .object({
    listingId: z.number().int().positive().meta({ example: 1 }),
    quantity: z.number().int().min(1).max(MAX_TICKETS_PER_ORDER).meta({ example: 2 }),
    locale: z.enum(SUPPORTED_LOCALES).optional().meta({ description: 'Payment page language; default vi' }),
  })
  .meta({ id: 'CreateOrderInput' }) satisfies z.ZodType<CreateOrderInput>;

export const OrderIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().meta({ description: 'Order id', example: 1 }),
});

const isoDate = z.iso.datetime();

export const OrderSchema = z
  .object({
    id: z.number().int(),
    status: z.enum(ORDER_STATUSES),
    event: z.object({ id: z.number().int(), name: z.string(), venue: z.string(), startsAt: isoDate }),
    seller: z.object({ id: z.number().int(), name: z.string() }),
    quantity: z.number().int().meta({ example: 2 }),
    unitPrice: z.number().int().meta({ description: 'VND, frozen at checkout', example: 450000 }),
    subtotal: z.number().int().meta({ example: 900000 }),
    buyerFee: z.number().int().meta({ description: '10% service fee', example: 90000 }),
    total: z.number().int().meta({ description: 'What the buyer pays', example: 990000 }),
    createdAt: isoDate,
    expiresAt: isoDate.meta({ description: 'End of the ticket reservation' }),
    paidAt: isoDate.nullable(),
  })
  .meta({ id: 'Order' }) satisfies z.ZodType<OrderDto>;

export const CreateOrderResponseSchema = z
  .object({
    order: OrderSchema,
    paymentUrl: z.url().meta({ description: 'Signed VNPay URL to send the buyer to' }),
  })
  .meta({ id: 'CreateOrderResponse' }) satisfies z.ZodType<CreateOrderResponse>;
