import { ShieldAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EventAdminList } from '@/features/admin/components/event-admin-list';
import { TrialBalance } from '@/features/admin/components/trial-balance';
import { Container } from '@/components/layout/container';
import { EmptyState } from '@/components/ui/empty-state';
import { getCurrentUser } from '@/features/users/api';
import { getTrialBalance, listAdminEvents, listRefunds } from '@/features/admin/api';
import { RefundList } from '@/features/admin/components/refund-list';

export default async function AdminPage({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params;
  const [t, user] = await Promise.all([getTranslations('admin'), getCurrentUser()]);

  if (user.role !== 'ADMIN') {
    return (
      <Container className="py-10">
        <EmptyState icon={ShieldAlert} title={t('forbidden')} />
      </Container>
    );
  }

  const [events, trialBalance, refunds] = await Promise.all([listAdminEvents(), getTrialBalance(), listRefunds()]);

  return (
    <Container className="space-y-6 py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <EventAdminList page={events} locale={locale} />
        <TrialBalance trialBalance={trialBalance} locale={locale} />
        <RefundList page={refunds} locale={locale} />
      </div>
    </Container>
  );
}
