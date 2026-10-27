import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound('ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`));
};
