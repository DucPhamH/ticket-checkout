import { getTranslations } from 'next-intl/server';
import type { OrderStatus } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_VARIANT } from '../constants';

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = await getTranslations('status.order');
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{t(status)}</Badge>;
}
