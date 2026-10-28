import { RotateCcw } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Page, RefundDto } from '@tc/shared';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MoreRefunds } from './more-refunds';
import { RefundRow } from './refund-row';

// First page rendered on the server; later pages are added by "Load more".
export async function RefundList({ page, locale }: { page: Page<RefundDto>; locale: string }) {
  const t = await getTranslations('admin');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t('refunds')}</CardTitle>
      </CardHeader>
      {page.items.length === 0 ? (
        <EmptyState icon={RotateCcw} title={t('noRefunds')} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {page.items.map((refund) => (
            <RefundRow key={refund.id} refund={refund} locale={locale} />
          ))}
          <MoreRefunds initialCursor={page.nextCursor} locale={locale} />
        </ul>
      )}
    </Card>
  );
}
