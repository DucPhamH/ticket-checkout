'use server';

import { listAdminEvents } from './api';

// Next page for the "Load more" button; runs on the server as the session user.
export async function loadMoreAdminEvents(cursor: string) {
  return listAdminEvents(cursor);
}
