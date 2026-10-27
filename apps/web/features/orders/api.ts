import 'server-only';
import type { OrderDto } from '@tc/shared';
import { MOCK_ORDERS } from '@/mocks/data';

export async function getOrder(id: number): Promise<OrderDto | null> {
  return MOCK_ORDERS.find((order) => order.id === id) ?? null;
}

export async function listMyOrders(_userId: number): Promise<OrderDto[]> {
  return MOCK_ORDERS;
}
