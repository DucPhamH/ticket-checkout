import type { BalancesDto } from '@tc/shared';
import { toNumber } from '../../lib/money';
import type { UserBalances } from '../ledger/ledger.balances';

export function toBalancesDto(balances: UserBalances): BalancesDto {
  return {
    pending: toNumber(balances.pending),
    available: toNumber(balances.available),
    refundPending: toNumber(balances.refundPending),
  };
}
