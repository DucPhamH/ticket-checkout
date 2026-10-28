import { useTranslations } from 'next-intl';
import type { RefundDto } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatVnd } from '@/lib/format';
import { REFUND_STATUS_VARIANT } from '../constants';
import { RetryRefundButton } from './retry-refund-button';

export function RefundRow({ refund, locale }: { refund: RefundDto; locale: string }) {
  const t = useTranslations('admin');
  return (
    <li className="space-y-2 px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            #{refund.orderId} · {refund.buyer.name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {refund.event.name} ·{' '}
            {t.has(`refundReason.${refund.reason}`) ? t(`refundReason.${refund.reason}`) : refund.reason}
          </p>
          <p className="text-xs text-slate-500">
            {formatDateTime(refund.completedAt ?? refund.createdAt, locale)}
            {refund.attempts > 0 && ` · ${t('attempts', { count: refund.attempts })}`}
          </p>
          {refund.lastError && (
            <p className="mt-0.5 font-mono text-[11px] break-all text-red-600">{refund.lastError}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">{formatVnd(refund.amount, locale)}</span>
          <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{t(`refundStatus.${refund.status}`)}</Badge>
        </div>
      </div>
      {refund.status !== 'SUCCEEDED' && <RetryRefundButton refundId={refund.id} />}
    </li>
  );
}
