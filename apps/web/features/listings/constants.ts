import type { ListingStatus } from '@tc/shared';
import type { BadgeVariant } from '@/components/ui/badge';

export const LISTING_STATUS_VARIANT: Record<ListingStatus, BadgeVariant> = {
  ACTIVE: 'brand',
  WITHDRAWN: 'neutral',
};
