import type { RequestHandler } from 'express';
import { UserRole } from '../generated/prisma/enums';
import { HttpError } from '../lib/http-error';
import { requireCurrentUser } from './current-user';

// Mount after currentUser. There is no real authentication in this demo: the role comes from
// the user chosen in the switcher, which is enough to keep admin actions out of buyers' hands.
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (requireCurrentUser(req).role !== UserRole.ADMIN) {
    throw HttpError.forbidden('ADMIN_ONLY', 'Only an admin can do this');
  }
  next();
};
