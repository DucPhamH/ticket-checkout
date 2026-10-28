import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { requireAdmin } from '../../middlewares/require-admin';
import { getAdminTrialBalance } from './admin.controller';

export const adminRouter = Router();

// Every admin route needs a user, and that user must be an admin.
adminRouter.use('/admin', currentUser, requireAdmin);
adminRouter.get('/admin/trial-balance', getAdminTrialBalance);
