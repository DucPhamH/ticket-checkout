'use client';

import { LoadMoreButton } from '@/components/ui/load-more-button';
import { useLoadMore } from '@/hooks/use-load-more';
import { loadMoreAdminEvents } from '../actions';
import { AdminEventRow } from './admin-event-row';

// The pages after the first, appended in the browser when "Load more" is pressed.
export function MoreAdminEvents({ initialCursor, locale }: { initialCursor: string | null; locale: string }) {
  const { items, hasMore, loading, failed, loadMore } = useLoadMore(initialCursor, loadMoreAdminEvents);
  return (
    <>
      {items.map((event) => (
        <AdminEventRow key={event.id} event={event} locale={locale} />
      ))}
      {hasMore && (
        <li>
          <LoadMoreButton loading={loading} failed={failed} onClick={loadMore} />
        </li>
      )}
    </>
  );
}
