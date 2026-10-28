import type { OrderDto } from '@tc/shared';
import { toNumber } from '../../lib/money';
import type { OrderWithDetails } from './orders.service';

export function toOrderDto(order: OrderWithDetails): OrderDto {
  const { event, seller } = order.listing;
  return {
    id: order.id,
    status: order.status,
    event: { id: event.id, name: event.name, venue: event.venue, startsAt: event.startsAt.toISOString() },
    seller,
    quantity: order.quantity,
    unitPrice: toNumber(order.unitPrice),
    subtotal: toNumber(order.subtotal),
    buyerFee: toNumber(order.buyerFee),
    total: toNumber(order.total),
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    paymentResultCode: order.payment?.providerResponseCode ?? null,
  };
}
