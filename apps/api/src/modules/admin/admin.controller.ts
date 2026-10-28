import type { RequestHandler } from 'express';
import { getTrialBalance } from '../ledger/ledger.balances';
import { toTrialBalanceDto } from './admin.mapper';

export const getAdminTrialBalance: RequestHandler = async (_req, res) => {
  res.json(toTrialBalanceDto(await getTrialBalance()));
};
