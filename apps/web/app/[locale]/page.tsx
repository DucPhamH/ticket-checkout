import { CalendarX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EventCard } from '@/features/events/components/event-card';
import { Container } from '@/components/layout/container';
import { EmptyState } from '@/components/ui/empty-state';
import { listEvents } from '@/features/events/api';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const [t, events] = await Promise.all([getTranslations('home'), listEvents()]);

  return (
    <Container className="py-6 sm:py-10">
      <header className="mb-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('subtitle')}</p>
      </header>
      {events.length === 0 ? (
        <EmptyState icon={CalendarX} title={t('empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} locale={locale} />
          ))}
        </div>
      )}
    </Container>
  );
}
