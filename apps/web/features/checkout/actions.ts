'use server';

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { ROUTES } from '@/constants/routes';

// Design phase: pretend an order was created and land on the pending result screen.
// Step 5/6 replaces this with: POST api/orders → redirect to the VNPay payment URL.
export async function createOrder(_formData: FormData) {
  redirect({ href: ROUTES.order(102), locale: await getLocale() });
}
