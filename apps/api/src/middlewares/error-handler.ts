import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@tc/shared';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

// Every error leaves the api in the same shape: { error: { code, message } }.
// Expected errors (HttpError, ZodError) are logged by the request logger as warn; only unexpected ones get a stack.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues.map((issue) => [issue.path.join('.'), issue.message].filter(Boolean).join(': ')).join('; '),
      },
    };
  } else {
    // Unexpected: log the full error with the request id; the client only gets a generic message.
    logger.error({ err, reqId: req.id }, 'Unhandled error');
  }

  res.status(status).json(body);
};
