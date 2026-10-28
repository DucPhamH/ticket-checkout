import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { OrderAutoRefresh } from '@/features/orders/components/order-auto-refresh';
import { OrderResultHero } from '@/features/orders/components/order-result-hero';
import { OrderSummary } from '@/features/orders/components/order-summary';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { getOrder } from '@/features/orders/api';

// Shows the order's real status from the database, never the gateway's redirect parameters.
export default async function OrderPage({ params }: PageProps<'/[locale]/orders/[id]'>) {
  const { locale, id } = await params;
  const [t, order] = await Promise.all([getTranslations('order'), getOrder(id)]);
  if (!order) notFound();

  return (
    <Container className="max-w-lg py-4 sm:py-8">
      {order.status === 'PENDING' && <OrderAutoRefresh />}
      <OrderResultHero order={order} />
      <OrderSummary order={order} locale={locale} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href={ROUTES.wallet} className={buttonVariants({ variant: 'primary', fullWidth: true })}>
          {t('goToWallet')}
        </Link>
        <Link href={ROUTES.event(order.event.id)} className={buttonVariants({ variant: 'outline', fullWidth: true })}>
          {order.status === 'FAILED' || order.status === 'EXPIRED' ? t('tryAgain') : t('backToEvent')}
        </Link>
      </div>
    </Container>
  );
}
