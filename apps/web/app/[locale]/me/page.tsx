import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { OrderList } from '@/features/orders/components/order-list';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { BalanceCards } from '@/features/wallet/components/balance-cards';
import { LedgerList } from '@/features/wallet/components/ledger-list';
import { getCurrentUser } from '@/features/users/api';
import { listMyOrders } from '@/features/orders/api';
import { getBalances, listMyLedger } from '@/features/wallet/api';

export default async function WalletPage({ params }: PageProps<'/[locale]/me'>) {
  const { locale } = await params;
  const user = await getCurrentUser();
  const [t, balances, orders, ledger] = await Promise.all([
    getTranslations('wallet'),
    getBalances(user.id),
    listMyOrders(user.id),
    listMyLedger(user.id),
  ]);

  return (
    <Container className="space-y-6 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      </header>
      <BalanceCards balances={balances} locale={locale} />
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t('myOrders')}</CardTitle>
          </CardHeader>
          <OrderList orders={orders} locale={locale} />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t('ledger')}</CardTitle>
          </CardHeader>
          <LedgerList lines={ledger} locale={locale} />
        </Card>
      </div>
    </Container>
  );
}
