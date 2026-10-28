import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { getMyBalances } from './wallet.controller';

export const walletRouter = Router();

walletRouter.get('/me/balances', currentUser, getMyBalances);
