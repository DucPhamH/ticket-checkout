import type { EventStatus } from '@tc/shared';
import type { BadgeVariant } from '@/components/ui/badge';

// Shared: used by both the events and admin features.
export const EVENT_STATUS_VARIANT: Record<EventStatus, BadgeVariant> = {
  ACTIVE: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
