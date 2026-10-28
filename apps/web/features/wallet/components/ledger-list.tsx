import { BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { LedgerLineDto, Page } from '@tc/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from './ledger-row';
import { MoreLedger } from './more-ledger';

// First page rendered on the server; later pages are added by "Load more".
export async function LedgerList({ page, locale }: { page: Page<LedgerLineDto>; locale: string }) {
  const t = await getTranslations('wallet');
  if (page.items.length === 0) return <EmptyState icon={BookOpen} title={t('noLedger')} />;

  return (
    <ul className="divide-y divide-slate-100">
      {page.items.map((line) => (
        <LedgerRow key={line.id} line={line} locale={locale} />
      ))}
      <MoreLedger initialCursor={page.nextCursor} locale={locale} />
    </ul>
  );
}
