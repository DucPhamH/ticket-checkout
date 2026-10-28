'use client';

import { LoadMoreButton } from '@/components/ui/load-more-button';
import { useLoadMore } from '@/hooks/use-load-more';
import { loadMoreRefunds } from '../actions';
import { RefundRow } from './refund-row';

// The pages after the first, appended in the browser when "Load more" is pressed.
export function MoreRefunds({ initialCursor, locale }: { initialCursor: string | null; locale: string }) {
  const { items, hasMore, loading, failed, loadMore } = useLoadMore(initialCursor, loadMoreRefunds);
  return (
    <>
      {items.map((refund) => (
        <RefundRow key={refund.id} refund={refund} locale={locale} />
      ))}
      {hasMore && (
        <li>
          <LoadMoreButton loading={loading} failed={failed} onClick={loadMore} />
        </li>
      )}
    </>
  );
}
