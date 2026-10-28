import 'server-only';
import type { OrderDto, Page } from '@tc/shared';
import { LIST_PAGE_SIZE } from '@/constants/app';
import { ApiError, apiRequest } from '@/lib/api-client';

// Null when the order does not exist or belongs to someone else (the api answers 404 for both).
export async function getOrder(id: string): Promise<OrderDto | null> {
  try {
    return await apiRequest<OrderDto>(`/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

// One page of the current user's orders, newest first. No cursor = first page.
export function listMyOrders(cursor?: string): Promise<Page<OrderDto>> {
  const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE), ...(cursor && { cursor }) });
  return apiRequest<Page<OrderDto>>(`/me/orders?${query}`);
}
