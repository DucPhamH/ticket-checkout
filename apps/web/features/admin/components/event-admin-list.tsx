import { getTranslations } from 'next-intl/server';
import type { EventSummaryDto } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_STATUS_VARIANT } from '@/constants/status-styles';
import { formatDateTime } from '@/lib/format';

// Design phase: buttons are inert. Step 7/8 wires them to server actions.
export async function EventAdminList({ events, locale }: { events: EventSummaryDto[]; locale: string }) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t('admin.events')}</CardTitle>
      </CardHeader>
      <ul className="divide-y divide-slate-100">
        {events.map((event) => (
          <li key={event.id} className="space-y-3 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{event.name}</p>
                <p className="text-xs text-slate-500">{formatDateTime(event.startsAt, locale)}</p>
              </div>
              <Badge variant={EVENT_STATUS_VARIANT[event.status]}>{t(`status.event.${event.status}`)}</Badge>
            </div>
            {event.status === 'ACTIVE' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm">{t('admin.complete')}</Button>
                <Button size="sm" variant="outline" className="text-red-600">
                  {t('admin.cancel')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
