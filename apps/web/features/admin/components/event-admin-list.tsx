import { CalendarX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { AdminEventDto, Page } from '@tc/shared';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AdminEventRow } from './admin-event-row';
import { MoreAdminEvents } from './more-admin-events';

// First page rendered on the server; later pages are added by "Load more".
export async function EventAdminList({ page, locale }: { page: Page<AdminEventDto>; locale: string }) {
  const t = await getTranslations('admin');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t('events')}</CardTitle>
      </CardHeader>
      {page.items.length === 0 ? (
        <EmptyState icon={CalendarX} title={t('noEvents')} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {page.items.map((event) => (
            <AdminEventRow key={event.id} event={event} locale={locale} />
          ))}
          <MoreAdminEvents initialCursor={page.nextCursor} locale={locale} />
        </ul>
      )}
    </Card>
  );
}
