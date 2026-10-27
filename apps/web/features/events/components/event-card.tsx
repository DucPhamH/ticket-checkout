import { MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { EventSummaryDto } from '@tc/shared';
import { eventCover } from '../constants';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatDateTime, formatVnd } from '@/lib/format';
import { EventDateBlock } from './event-date-block';

export async function EventCard({ event, locale }: { event: EventSummaryDto; locale: string }) {
  const t = await getTranslations('home');

  return (
    <Link
      href={ROUTES.event(event.id)}
      className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={cn('relative h-36 bg-gradient-to-br sm:h-40', eventCover(event.id))}>
        <EventDateBlock startsAt={event.startsAt} locale={locale} className="absolute top-3 left-3" />
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">{event.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">
            {event.venue}, {event.city}
          </span>
        </p>
        <p className="text-xs text-slate-500">{formatDateTime(event.startsAt, locale)}</p>
        <div className="flex items-end justify-between pt-1">
          {event.minPrice !== null ? (
            <p className="text-sm text-slate-500">
              {t('from')} <span className="text-base font-bold text-slate-900">{formatVnd(event.minPrice, locale)}</span>
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs font-medium text-emerald-700">{t('ticketsLeft', { count: event.ticketsAvailable })}</span>
        </div>
      </div>
    </Link>
  );
}
