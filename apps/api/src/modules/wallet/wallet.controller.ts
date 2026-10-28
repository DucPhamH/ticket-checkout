import type { RequestHandler } from 'express';
import type { LedgerLineDto, Page } from '@tc/shared';
import { toPage } from '../../lib/pagination';
import { requireCurrentUser } from '../../middlewares/current-user';
import { getUserBalances } from '../ledger/ledger.balances';
import { listUserLedgerEntries } from '../ledger/ledger.history';
import { toBalancesDto, toLedgerLineDto } from './wallet.mapper';
import { MyLedgerQuerySchema } from './wallet.schema';

export const getMyBalances: RequestHandler = async (req, res) => {
  const balances = await getUserBalances(requireCurrentUser(req).id);
  res.json(toBalancesDto(balances));
};

export const getMyLedger: RequestHandler = async (req, res) => {
  const { limit, cursor } = MyLedgerQuerySchema.parse(req.query);
  const entries = await listUserLedgerEntries(requireCurrentUser(req).id, { limit, afterId: cursor?.id });
  const page = toPage(entries, limit, toLedgerLineDto, (entry) => ({ id: entry.id }));
  res.json(page satisfies Page<LedgerLineDto>);
};
