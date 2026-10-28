import { useState, useTransition } from 'react';
import type { Page } from '@tc/shared';

/**
 * "Load more" for a cursor-paginated list whose first page was rendered on the server.
 * Holds the extra pages fetched in the browser; remount it (via `key`) to start over.
 */
export function useLoadMore<T>(initialCursor: string | null, loadPage: (cursor: string) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [loading, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    startTransition(async () => {
      try {
        const page = await loadPage(cursor);
        setItems((previous) => [...previous, ...page.items]);
        setCursor(page.nextCursor);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  };

  return { items, hasMore: cursor !== null, loading, failed, loadMore };
}
