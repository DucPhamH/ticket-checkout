import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { requireAdmin } from '../../middlewares/require-admin';
import {
  getAdminEvents,
  getAdminRefunds,
  getAdminTrialBalance,
  postCancelEvent,
  postCompleteEvent,
  postRetryRefund,
} from './admin.controller';

export const adminRouter = Router();

// Every admin route needs a user, and that user must be an admin.
adminRouter.use('/admin', currentUser, requireAdmin);
adminRouter.get('/admin/trial-balance', getAdminTrialBalance);
adminRouter.get('/admin/events', getAdminEvents);
adminRouter.post('/admin/events/:id/complete', postCompleteEvent);
adminRouter.post('/admin/events/:id/cancel', postCancelEvent);
adminRouter.get('/admin/refunds', getAdminRefunds);
adminRouter.post('/admin/refunds/:id/retry', postRetryRefund);
