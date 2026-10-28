import 'server-only';
import type { TrialBalanceDto } from '@tc/shared';
import { apiRequest } from '@/lib/api-client';

export function getTrialBalance(): Promise<TrialBalanceDto> {
  return apiRequest<TrialBalanceDto>('/admin/trial-balance');
}
