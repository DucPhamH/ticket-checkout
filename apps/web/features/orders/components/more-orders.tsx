'use client';

import { LoadMoreButton } from '@/components/ui/load-more-button';
import { useLoadMore } from '@/hooks/use-load-more';
import { loadMoreOrders } from '../actions';
import { OrderRow } from './order-row';

// The pages after the first, appended in the browser when "Load more" is pressed.
export function MoreOrders({ initialCursor, locale }: { initialCursor: string | null; locale: string }) {
  const { items, hasMore, loading, failed, loadMore } = useLoadMore(initialCursor, loadMoreOrders);
  return (
    <>
      {items.map((order) => (
        <OrderRow key={order.id} order={order} locale={locale} />
      ))}
      {hasMore && (
        <li>
          <LoadMoreButton loading={loading} failed={failed} onClick={loadMore} />
        </li>
      )}
    </>
  );
}
