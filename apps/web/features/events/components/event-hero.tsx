import { CalendarDays, ChevronLeft, MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { EventDetailDto } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { eventCover } from '../constants';
import { ROUTES } from '@/constants/routes';
import { EVENT_STATUS_VARIANT } from '@/constants/status-styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

export async function EventHero({ event, locale }: { event: EventDetailDto; locale: string }) {
  const t = await getTranslations();

  return (
    <section className={cn('bg-gradient-to-br text-white', eventCover(event.id))}>
      <div className="bg-black/25">
        <Container className="py-5 sm:py-10">
          <Link href={ROUTES.home} className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-white">
            <ChevronLeft className="size-4" />
            {t('event.back')}
          </Link>
          <div className="mt-4 space-y-3 sm:mt-6">
            <Badge variant={EVENT_STATUS_VARIANT[event.status]} className="bg-white/90">
              {t(`status.event.${event.status}`)}
            </Badge>
            <h1 className="text-2xl leading-tight font-bold sm:text-4xl">{event.name}</h1>
            <div className="flex flex-col gap-1.5 text-sm text-white/90 sm:flex-row sm:gap-5">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {formatDateTime(event.startsAt, locale)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {event.venue}, {event.city}
              </span>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
