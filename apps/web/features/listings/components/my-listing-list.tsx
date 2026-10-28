import { Tag } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { MyListingDto, Page } from '@tc/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { MoreMyListings } from './more-my-listings';
import { MyListingRow } from './my-listing-row';

// First page rendered on the server; later pages are added by "Load more".
export async function MyListingList({ page, locale }: { page: Page<MyListingDto>; locale: string }) {
  const t = await getTranslations('sell');
  if (page.items.length === 0) return <EmptyState icon={Tag} title={t('noListings')} />;

  return (
    <ul className="divide-y divide-slate-100">
      {page.items.map((listing) => (
        <MyListingRow key={listing.id} listing={listing} locale={locale} />
      ))}
      <MoreMyListings initialCursor={page.nextCursor} locale={locale} />
    </ul>
  );
}
