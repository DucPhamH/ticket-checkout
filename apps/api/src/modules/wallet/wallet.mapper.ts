import type { BalancesDto, LedgerLineDto } from '@tc/shared';
import { toNumber } from '../../lib/money';
import type { UserBalances } from '../ledger/ledger.balances';
import type { UserLedgerEntry } from '../ledger/ledger.history';

export function toBalancesDto(balances: UserBalances): BalancesDto {
  return {
    pending: toNumber(balances.pending),
    available: toNumber(balances.available),
    refundPending: toNumber(balances.refundPending),
  };
}

export function toLedgerLineDto(entry: UserLedgerEntry): LedgerLineDto {
  return {
    id: entry.id,
    createdAt: entry.transaction.createdAt.toISOString(),
    kind: entry.transaction.kind,
    account: entry.account.code,
    amount: toNumber(entry.amount),
    orderId: entry.transaction.orderId,
    eventId: entry.transaction.eventId,
  };
}
