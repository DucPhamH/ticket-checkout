import 'server-only';
import type { BalancesDto, LedgerLineDto } from '@tc/shared';
import { MOCK_BALANCES, MOCK_LEDGER } from '@/mocks/data';

export async function getBalances(userId: number): Promise<BalancesDto> {
  return MOCK_BALANCES[userId] ?? { pending: 0, available: 0, refundPending: 0 };
}

export async function listMyLedger(_userId: number): Promise<LedgerLineDto[]> {
  return MOCK_LEDGER;
}
