'use server';

import { revalidatePath } from 'next/cache';
import type { CompleteEventResultDto } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';
import { listAdminEvents } from './api';

// Next page for the "Load more" button; runs on the server as the session user.
export async function loadMoreAdminEvents(cursor: string) {
  return listAdminEvents(cursor);
}

export type CompleteEventState = { ok: true; result: CompleteEventResultDto } | { ok: false; errorCode: string };

// Marks the event as taken place; the api releases its escrow. Re-renders the admin page so the
// event's status and the trial balance update.
export async function completeEvent(eventId: number): Promise<CompleteEventState> {
  try {
    const result = await apiRequest<CompleteEventResultDto>(`/admin/events/${eventId}/complete`, { method: 'POST' });
    revalidatePath('/[locale]/admin', 'page');
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, errorCode: error.code };
    throw error;
  }
}
