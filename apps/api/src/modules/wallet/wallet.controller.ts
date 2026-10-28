import type { RequestHandler } from 'express';
import { requireCurrentUser } from '../../middlewares/current-user';
import { getUserBalances } from '../ledger/ledger.balances';
import { toBalancesDto } from './wallet.mapper';

export const getMyBalances: RequestHandler = async (req, res) => {
  const balances = await getUserBalances(requireCurrentUser(req).id);
  res.json(toBalancesDto(balances));
};
