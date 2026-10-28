import { useTranslations } from 'next-intl';
import type { AdminEventDto } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { EVENT_STATUS_VARIANT } from '@/constants/status-styles';
import { formatDateTime, formatVnd } from '@/lib/format';
import { CancelEventButton } from './cancel-event-button';
import { CompleteEventButton } from './complete-event-button';

export function AdminEventRow({ event, locale }: { event: AdminEventDto; locale: string }) {
  const t = useTranslations();
  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{event.name}</p>
          <p className="text-xs text-slate-500">{formatDateTime(event.startsAt, locale)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t('admin.sales', { orders: event.paidOrders, tickets: event.ticketsSold })} ·{' '}
            <span className="font-medium tabular-nums">{formatVnd(event.paidTotal, locale)}</span>
          </p>
        </div>
        <Badge variant={EVENT_STATUS_VARIANT[event.status]}>{t(`status.event.${event.status}`)}</Badge>
      </div>
      {event.completedAt && (
        <p className="text-xs text-emerald-700">
          {t('admin.settledAt', { date: formatDateTime(event.completedAt, locale) })}
        </p>
      )}
      {event.cancelledAt && (
        <p className="text-xs text-red-600">
          {t('admin.cancelledAt', { date: formatDateTime(event.cancelledAt, locale) })}
        </p>
      )}
      {event.status === 'ACTIVE' && (
        <div className="flex flex-wrap items-start gap-2">
          <CompleteEventButton eventId={event.id} locale={locale} />
          {/* Once an event has started it can only be completed, not cancelled. */}
          {new Date(event.startsAt) > new Date() && <CancelEventButton eventId={event.id} />}
        </div>
      )}
    </li>
  );
}
