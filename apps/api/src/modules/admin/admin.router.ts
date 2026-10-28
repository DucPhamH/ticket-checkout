import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { requireAdmin } from '../../middlewares/require-admin';
import { getAdminEvents, getAdminTrialBalance, postCompleteEvent } from './admin.controller';

export const adminRouter = Router();

// Every admin route needs a user, and that user must be an admin.
adminRouter.use('/admin', currentUser, requireAdmin);
adminRouter.get('/admin/trial-balance', getAdminTrialBalance);
adminRouter.get('/admin/events', getAdminEvents);
adminRouter.post('/admin/events/:id/complete', postCompleteEvent);
