'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ORDER_POLL_INTERVAL_MS } from '../constants';

// While an order is PENDING, re-render the server page so it picks up the IPN result.
export function OrderAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), ORDER_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
