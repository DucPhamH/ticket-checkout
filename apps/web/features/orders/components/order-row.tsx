import { ChevronRight } from 'lucide-react';
import type { OrderDto } from '@tc/shared';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatVnd } from '@/lib/format';
import { OrderStatusBadge } from './order-status-badge';

export function OrderRow({ order, locale }: { order: OrderDto; locale: string }) {
  return (
    <li>
      <Link
        href={ROUTES.order(order.id)}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{order.event.name}</p>
          <p className="truncate text-xs text-slate-500">
            #{order.id} · {order.quantity} × {formatVnd(order.unitPrice, locale)} ·{' '}
            {formatDateTime(order.createdAt, locale)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">{formatVnd(order.total, locale)}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <ChevronRight className="size-4 text-slate-300" />
      </Link>
    </li>
  );
}
