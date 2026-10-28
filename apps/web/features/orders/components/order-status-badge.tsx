import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_VARIANT } from '../constants';

// Not async, so it also renders inside client components (e.g. rows added by "Load more").
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('status.order');
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{t(status)}</Badge>;
}
