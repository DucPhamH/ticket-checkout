'use server';

import { revalidatePath } from 'next/cache';
import type { CancelEventResultDto, CompleteEventResultDto, RefundDto } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';
import { listAdminEvents, listRefunds } from './api';

// Next pages for the "Load more" buttons; run on the server as the session user.
export async function loadMoreAdminEvents(cursor: string) {
  return listAdminEvents(cursor);
}

export async function loadMoreRefunds(cursor: string) {
  return listRefunds(cursor);
}

type ActionState<T> = { ok: true; result: T } | { ok: false; errorCode: string };

// Calls an admin endpoint, then re-renders the admin page (event status, refunds, trial balance).
async function adminPost<T>(path: string): Promise<ActionState<T>> {
  try {
    const result = await apiRequest<T>(path, { method: 'POST' });
    revalidatePath('/[locale]/admin', 'page');
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, errorCode: error.code };
    throw error;
  }
}

export type CompleteEventState = ActionState<CompleteEventResultDto>;
export type CancelEventState = ActionState<CancelEventResultDto>;
export type RetryRefundState = ActionState<RefundDto>;

// Marks the event as taken place; the api releases its escrow.
export async function completeEvent(eventId: number): Promise<CompleteEventState> {
  return adminPost(`/admin/events/${eventId}/complete`);
}

// Cancels the event; the api refunds every paid order through VNPay.
export async function cancelEvent(eventId: number): Promise<CancelEventState> {
  return adminPost(`/admin/events/${eventId}/cancel`);
}

// Sends a pending or failed refund to VNPay again.
export async function retryRefund(refundId: number): Promise<RetryRefundState> {
  return adminPost(`/admin/refunds/${refundId}/retry`);
}
