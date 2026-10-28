import 'server-only';
import type { BalancesDto, LedgerLineDto } from '@tc/shared';
import { apiRequest } from '@/lib/api-client';
import { MOCK_LEDGER } from '@/mocks/data';

export function getBalances(userId: number): Promise<BalancesDto> {
  return apiRequest<BalancesDto>('/me/balances', { userId });
}

// Still mock data: the ledger history API comes next.
export async function listMyLedger(_userId: number): Promise<LedgerLineDto[]> {
  return MOCK_LEDGER;
}
