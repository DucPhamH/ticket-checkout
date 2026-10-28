import 'server-only';
import type { AdminEventDto, Page, TrialBalanceDto } from '@tc/shared';
import { LIST_PAGE_SIZE } from '@/constants/app';
import { apiRequest } from '@/lib/api-client';

export function getTrialBalance(): Promise<TrialBalanceDto> {
  return apiRequest<TrialBalanceDto>('/admin/trial-balance');
}

// One page of all events with their paid sales, soonest first. No cursor = first page.
export function listAdminEvents(cursor?: string): Promise<Page<AdminEventDto>> {
  const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE), ...(cursor && { cursor }) });
  return apiRequest<Page<AdminEventDto>>(`/admin/events?${query}`);
}
