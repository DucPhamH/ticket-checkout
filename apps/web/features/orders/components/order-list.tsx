import { Ticket } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { OrderDto, Page } from '@tc/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { MoreOrders } from './more-orders';
import { OrderRow } from './order-row';

// First page rendered on the server; later pages are added by "Load more".
export async function OrderList({ page, locale }: { page: Page<OrderDto>; locale: string }) {
  const t = await getTranslations('wallet');
  if (page.items.length === 0) return <EmptyState icon={Ticket} title={t('noOrders')} />;

  return (
    <ul className="divide-y divide-slate-100">
      {page.items.map((order) => (
        <OrderRow key={order.id} order={order} locale={locale} />
      ))}
      <MoreOrders initialCursor={page.nextCursor} locale={locale} />
    </ul>
  );
}
