import { getTranslations } from 'next-intl/server';
import type { OrderDto } from '@tc/shared';
import { PriceBreakdown } from '@/components/pricing/price-breakdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { OrderStatusBadge } from './order-status-badge';

export async function OrderSummary({ order, locale }: { order: OrderDto; locale: string }) {
  const t = await getTranslations('order');

  const rows: [string, string][] = [
    [t('event'), order.event.name],
    [t('seller'), order.seller.name],
    [t('tickets'), String(order.quantity)],
    [t('createdAt'), formatDateTime(order.createdAt, locale)],
  ];
  if (order.paidAt) rows.push([t('paidAt'), formatDateTime(order.paidAt, locale)]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title', { id: order.id })}</CardTitle>
        <OrderStatusBadge status={order.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <PriceBreakdown unitPrice={order.unitPrice} quantity={order.quantity} amounts={order} className="rounded-xl bg-slate-50 p-3" />
      </CardContent>
    </Card>
  );
}
