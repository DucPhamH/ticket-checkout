import type { OrderStatus } from '@tc/shared';
import type { BadgeVariant } from '@/components/ui/badge';

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
  REFUND_PENDING: 'warning',
  REFUNDED: 'neutral',
};

// How often the order result page re-checks a pending order.
export const ORDER_POLL_INTERVAL_MS = 3000;
