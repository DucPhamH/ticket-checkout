import 'server-only';
import { MOCK_TRIAL_BALANCE } from '@/mocks/data';

export async function getTrialBalance() {
  return MOCK_TRIAL_BALANCE;
}
