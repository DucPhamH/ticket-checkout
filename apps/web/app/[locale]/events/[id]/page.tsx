import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TicketPicker } from '@/features/checkout/components/ticket-picker';
import { EventHero } from '@/features/events/components/event-hero';
import { Container } from '@/components/layout/container';
import { InfoHint } from '@/components/ui/info-hint';
import { getCurrentUser } from '@/features/users/api';
import { getEvent } from '@/features/events/api';
import { SellForm } from '@/features/listings/components/sell-form';

export default async function EventPage({ params }: PageProps<'/[locale]/events/[id]'>) {
  const { locale, id } = await params;
  const [t, event, currentUser] = await Promise.all([getTranslations('event'), getEvent(id), getCurrentUser()]);
  if (!event) notFound();

  const { listings } = event; // the api only returns listings on sale

  return (
    <>
      <EventHero event={event} locale={locale} />
      <Container className="space-y-8 py-6 sm:py-8">
        {event.status !== 'ACTIVE' ? (
          <InfoHint>{t('notActive')}</InfoHint>
        ) : listings.length === 0 ? (
          <InfoHint>{t('noListings')}</InfoHint>
        ) : (
          <TicketPicker listings={listings} currentUserId={currentUser.id} />
        )}
        {event.status === 'ACTIVE' && currentUser.role !== 'ADMIN' && <SellForm eventId={event.id} locale={locale} />}
        <section className="max-w-2xl">
          <h2 className="mb-2 text-lg font-bold">{t('about')}</h2>
          <p className="text-sm leading-relaxed text-slate-600">{event.description}</p>
        </section>
      </Container>
    </>
  );
}
