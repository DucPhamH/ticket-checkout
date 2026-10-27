import type { Request, RequestHandler } from 'express';
import { USER_ID_HEADER } from '../constants/http';
import { HttpError } from '../lib/http-error';
import { findUserById } from '../modules/users/users.service';

// Resolves the X-User-Id header to a user. Stand-in for real authentication.
export const currentUser: RequestHandler = async (req, _res, next) => {
  const raw = req.header(USER_ID_HEADER);
  if (!raw) throw HttpError.unauthorized('MISSING_USER_ID', `The ${USER_ID_HEADER} header is required`);

  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw HttpError.unauthorized('INVALID_USER_ID', `${USER_ID_HEADER} must be a positive integer`);
  }

  const user = await findUserById(id);
  if (!user) throw HttpError.unauthorized('UNKNOWN_USER', `No user with id ${id}`);

  req.currentUser = user;
  next();
};

// For handlers mounted behind currentUser: the user is guaranteed to be set.
export function requireCurrentUser(req: Request) {
  if (!req.currentUser) throw new Error('currentUser middleware is missing on this route');
  return req.currentUser;
}
