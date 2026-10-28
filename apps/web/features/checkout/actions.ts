'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { CreateOrderInput, CreateOrderResponse, SupportedLocale } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';

// What the checkout form shows after a failed submit; null before the first attempt.
export type CheckoutState = { errorCode: string } | null;

// The buyer's address as seen by web; the api passes it to VNPay (vnp_IpAddr).
async function buyerIp(): Promise<string | undefined> {
  const incoming = await headers();
  return incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip') ?? undefined;
}

// Creates the order (the api reserves the tickets and opens a payment), then sends the
// browser to VNPay to pay.
export async function createOrder(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const input: CreateOrderInput = {
    listingId: Number(formData.get('listingId')),
    quantity: Number(formData.get('quantity')),
    locale: (await getLocale()) as SupportedLocale,
  };
  const ip = await buyerIp();

  let result: CreateOrderResponse;
  try {
    result = await apiRequest<CreateOrderResponse>('/orders', {
      method: 'POST',
      body: input,
      headers: ip ? { 'X-Forwarded-For': ip } : undefined,
    });
  } catch (error) {
    if (error instanceof ApiError) return { errorCode: error.code };
    throw error;
  }

  // redirect() works by throwing, so it must stay outside the try/catch above.
  // An external URL: Next's redirect (not the locale-aware one) sends the browser to VNPay.
  redirect(result.paymentUrl);
}
