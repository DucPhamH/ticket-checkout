'use server';

import { revalidatePath } from 'next/cache';
import type { CreateListingInput, MyListingDto } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';
import { listMyListings } from './api';

// What the sell form shows after a submit; null before the first attempt.
export type SellState = { ok: true; listing: MyListingDto } | { ok: false; errorCode: string } | null;

// Puts tickets on sale, then re-renders the pages that show listings.
export async function createListing(_previous: SellState, formData: FormData): Promise<SellState> {
  const input: CreateListingInput = {
    eventId: Number(formData.get('eventId')),
    unitPrice: Number(formData.get('unitPrice')),
    quantity: Number(formData.get('quantity')),
  };
  try {
    const listing = await apiRequest<MyListingDto>('/listings', { method: 'POST', body: input });
    revalidatePath('/[locale]/events/[id]', 'page');
    revalidatePath('/[locale]/me', 'page');
    return { ok: true, listing };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, errorCode: error.code };
    throw error;
  }
}

export type WithdrawState = { ok: true } | { ok: false; errorCode: string };

export async function withdrawListing(listingId: number): Promise<WithdrawState> {
  try {
    await apiRequest<MyListingDto>(`/listings/${listingId}/withdraw`, { method: 'POST' });
    revalidatePath('/[locale]/me', 'page');
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, errorCode: error.code };
    throw error;
  }
}

// Next page for the "Load more" button; runs on the server as the session user.
export async function loadMoreListings(cursor: string) {
  return listMyListings(cursor);
}
