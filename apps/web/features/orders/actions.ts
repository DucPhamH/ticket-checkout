'use server';

import { listMyOrders } from './api';

// Next page for the "Load more" button; runs on the server as the session user.
export async function loadMoreOrders(cursor: string) {
  return listMyOrders(cursor);
}
