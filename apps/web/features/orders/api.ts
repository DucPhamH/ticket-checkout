import 'server-only';
import type { OrderDto } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';
import { MOCK_ORDERS } from '@/mocks/data';

// Null when the order does not exist or belongs to someone else (the api answers 404 for both).
export async function getOrder(id: string): Promise<OrderDto | null> {
  try {
    return await apiRequest<OrderDto>(`/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

// Still mock data: "my orders" comes with the wallet API.
export async function listMyOrders(_userId: number): Promise<OrderDto[]> {
  return MOCK_ORDERS;
}
