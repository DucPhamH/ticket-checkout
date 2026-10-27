'use server';

import { getLocale } from 'next-intl/server';
import type { CreateOrderInput, OrderDto } from '@tc/shared';
import { ROUTES } from '@/constants/routes';
import { redirect } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api-client';

// What the checkout form shows after a failed submit; null before the first attempt.
export type CheckoutState = { errorCode: string } | null;

// Creates the order (the api reserves the tickets) and opens its page.
// Payment through VNPay is added in the next step.
export async function createOrder(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const input: CreateOrderInput = {
    listingId: Number(formData.get('listingId')),
    quantity: Number(formData.get('quantity')),
  };

  let order: OrderDto;
  try {
    order = await apiRequest<OrderDto>('/orders', { method: 'POST', body: input });
  } catch (error) {
    if (error instanceof ApiError) return { errorCode: error.code };
    throw error;
  }

  // redirect() works by throwing, so it must stay outside the try/catch above.
  redirect({ href: ROUTES.order(order.id), locale: await getLocale() });
  return null;
}
