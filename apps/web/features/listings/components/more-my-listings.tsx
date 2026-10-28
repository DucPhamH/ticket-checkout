'use client';

import { LoadMoreButton } from '@/components/ui/load-more-button';
import { useLoadMore } from '@/hooks/use-load-more';
import { loadMoreListings } from '../actions';
import { MyListingRow } from './my-listing-row';

// The pages after the first, appended in the browser when "Load more" is pressed.
export function MoreMyListings({ initialCursor, locale }: { initialCursor: string | null; locale: string }) {
  const { items, hasMore, loading, failed, loadMore } = useLoadMore(initialCursor, loadMoreListings);
  return (
    <>
      {items.map((listing) => (
        <MyListingRow key={listing.id} listing={listing} locale={locale} />
      ))}
      {hasMore && (
        <li>
          <LoadMoreButton loading={loading} failed={failed} onClick={loadMore} />
        </li>
      )}
    </>
  );
}
