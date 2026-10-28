import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { OrderDto, OrderStatus } from '@tc/shared';
import { cn } from '@/lib/cn';

const STATUS_VISUAL: Record<OrderStatus, { icon: LucideIcon; tone: string; spin?: boolean }> = {
  PENDING: { icon: Loader2, tone: 'bg-amber-50 text-amber-600', spin: true },
  PAID: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  FAILED: { icon: XCircle, tone: 'bg-red-50 text-red-600' },
  EXPIRED: { icon: Clock, tone: 'bg-slate-100 text-slate-500' },
  REFUND_PENDING: { icon: RotateCcw, tone: 'bg-amber-50 text-amber-600' },
  REFUNDED: { icon: RotateCcw, tone: 'bg-slate-100 text-slate-600' },
};

// What VNPay said went wrong, when the order failed for a reason the buyer can act on.
function failureReasonKey(order: Pick<OrderDto, 'status' | 'paymentResultCode'>) {
  return order.status === 'FAILED' && order.paymentResultCode ? `failureReason.${order.paymentResultCode}` : null;
}

export async function OrderResultHero({ order }: { order: Pick<OrderDto, 'status' | 'paymentResultCode'> }) {
  const t = await getTranslations('order');
  const { status } = order;
  const { icon: Icon, tone, spin } = STATUS_VISUAL[status];
  const reasonKey = failureReasonKey(order);

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-6 text-center">
      <span className={cn('flex size-20 items-center justify-center rounded-full', tone)}>
        <Icon className={cn('size-10', spin && 'animate-spin')} strokeWidth={1.75} />
      </span>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">{t(`result.${status}.title`)}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">{t(`result.${status}.body`)}</p>
      {reasonKey && t.has(reasonKey) && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
          {t('reasonLabel', { reason: t(reasonKey) })}
        </p>
      )}
    </div>
  );
}
