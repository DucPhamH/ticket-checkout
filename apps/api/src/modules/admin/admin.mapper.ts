import type { TrialBalanceDto } from '@tc/shared';
import { toNumber } from '../../lib/money';
import type { TrialBalance } from '../ledger/ledger.balances';

export function toTrialBalanceDto(trialBalance: TrialBalance): TrialBalanceDto {
  return {
    accounts: trialBalance.accounts.map((account) => ({ ...account, balance: toNumber(account.balance) })),
    total: toNumber(trialBalance.total),
  };
}
