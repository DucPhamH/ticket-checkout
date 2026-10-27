import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@tc/shared';
import { HttpError } from '../lib/http-error';

// Every error leaves the api in the same shape: { error: { code, message } }.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
    console.error(err);
  }

  res.status(status).json(body);
};
