import type { RefundStatus } from '@tc/shared';
import type { BadgeVariant } from '@/components/ui/badge';

export const REFUND_STATUS_VARIANT: Record<RefundStatus, BadgeVariant> = {
  PENDING: 'warning',
  FAILED: 'danger',
  SUCCEEDED: 'success',
};
