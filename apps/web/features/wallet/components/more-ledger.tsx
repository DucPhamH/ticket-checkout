'use client';

import { LoadMoreButton } from '@/components/ui/load-more-button';
import { useLoadMore } from '@/hooks/use-load-more';
import { loadMoreLedger } from '../actions';
import { LedgerRow } from './ledger-row';

// The pages after the first, appended in the browser when "Load more" is pressed.
export function MoreLedger({ initialCursor, locale }: { initialCursor: string | null; locale: string }) {
  const { items, hasMore, loading, failed, loadMore } = useLoadMore(initialCursor, loadMoreLedger);
  return (
    <>
      {items.map((line) => (
        <LedgerRow key={line.id} line={line} locale={locale} />
      ))}
      {hasMore && (
        <li>
          <LoadMoreButton loading={loading} failed={failed} onClick={loadMore} />
        </li>
      )}
    </>
  );
}
