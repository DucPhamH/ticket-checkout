'use server';

import { listMyLedger } from './api';

// Next page for the "Load more" button; runs on the server as the session user.
export async function loadMoreLedger(cursor: string) {
  return listMyLedger(cursor);
}
