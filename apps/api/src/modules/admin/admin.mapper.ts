import type { AdminEventDto, CompleteEventResultDto, TrialBalanceDto } from '@tc/shared';
import type { Event } from '../../generated/prisma/client';
import { toNumber } from '../../lib/money';
import type { CompletionResult } from '../events/event-completion';
import type { TrialBalance } from '../ledger/ledger.balances';
import type { EventSales } from './admin.service';

export function toTrialBalanceDto(trialBalance: TrialBalance): TrialBalanceDto {
  return {
    accounts: trialBalance.accounts.map((account) => ({ ...account, balance: toNumber(account.balance) })),
    total: toNumber(trialBalance.total),
  };
}

export function toAdminEventDto(event: Event, sales: EventSales): AdminEventDto {
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    completedAt: event.completedAt?.toISOString() ?? null,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    paidOrders: sales.paidOrders,
    ticketsSold: sales.ticketsSold,
    paidTotal: toNumber(sales.paidTotal),
  };
}

export function toCompleteEventResultDto(result: CompletionResult): CompleteEventResultDto {
  return {
    eventId: result.eventId,
    completedAt: result.completedAt.toISOString(),
    settledOrders: result.settledOrders,
    sellerPayouts: toNumber(result.sellerPayouts),
    platformRevenue: toNumber(result.platformRevenue),
  };
}
