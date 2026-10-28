import 'server-only';
import type { MyListingDto, Page } from '@tc/shared';
import { LIST_PAGE_SIZE } from '@/constants/app';
import { apiRequest } from '@/lib/api-client';

// One page of the current user's listings, newest first. No cursor = first page.
export function listMyListings(cursor?: string): Promise<Page<MyListingDto>> {
  const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE), ...(cursor && { cursor }) });
  return apiRequest<Page<MyListingDto>>(`/me/listings?${query}`);
}
