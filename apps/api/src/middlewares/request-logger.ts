import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { USER_ID_HEADER } from '../constants/http';
import { logger } from '../lib/logger';

const REQUEST_ID_HEADER = 'x-request-id';

// One line per request: "GET /events/1 200 12ms". 4xx logs as warn, 5xx as error.
// Every request gets an id (reused from X-Request-Id if the caller sent one) that is echoed back,
// so a single request can be found in the logs.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
    res.setHeader(REQUEST_ID_HEADER, id);
    return id;
  },
  customLogLevel: (_req, res, err) =>
    err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime)}ms`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  // Keep each line short: only what helps debugging.
  serializers: {
    req: (req) => ({ id: req.id, userId: req.headers[USER_ID_HEADER] }),
    res: () => undefined,
  },
  // Health checks run every few seconds from Docker; logging them would drown everything else.
  autoLogging: { ignore: (req) => req.url === '/health' },
});
