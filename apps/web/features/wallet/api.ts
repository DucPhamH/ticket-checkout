import 'server-only';
import type { BalancesDto, LedgerLineDto, Page } from '@tc/shared';
import { LIST_PAGE_SIZE } from '@/constants/app';
import { apiRequest } from '@/lib/api-client';

export function getBalances(userId: number): Promise<BalancesDto> {
  return apiRequest<BalancesDto>('/me/balances', { userId });
}

// One page of the ledger lines on the current user's accounts, newest first. No cursor = first page.
export function listMyLedger(cursor?: string): Promise<Page<LedgerLineDto>> {
  const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE), ...(cursor && { cursor }) });
  return apiRequest<Page<LedgerLineDto>>(`/me/ledger?${query}`);
}
