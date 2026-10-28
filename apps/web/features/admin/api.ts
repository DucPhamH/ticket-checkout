import 'server-only';
import type { AdminEventDto, Page, RefundDto, TrialBalanceDto } from '@tc/shared';
import { LIST_PAGE_SIZE } from '@/constants/app';
import { apiRequest } from '@/lib/api-client';

const pageQuery = (cursor?: string) =>
  new URLSearchParams({ limit: String(LIST_PAGE_SIZE), ...(cursor && { cursor }) });

export function getTrialBalance(): Promise<TrialBalanceDto> {
  return apiRequest<TrialBalanceDto>('/admin/trial-balance');
}

// One page of all events with their paid sales, soonest first. No cursor = first page.
export function listAdminEvents(cursor?: string): Promise<Page<AdminEventDto>> {
  return apiRequest<Page<AdminEventDto>>(`/admin/events?${pageQuery(cursor)}`);
}

// One page of refunds, newest first. No cursor = first page.
export function listRefunds(cursor?: string): Promise<Page<RefundDto>> {
  return apiRequest<Page<RefundDto>>(`/admin/refunds?${pageQuery(cursor)}`);
}
