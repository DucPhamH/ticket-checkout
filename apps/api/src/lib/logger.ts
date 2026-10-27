import pino from 'pino';
import { env } from '../config/env';

// Readable coloured lines while developing, JSON in production (for log tooling), silent in tests.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,responseTime',
          },
        }
      : undefined,
});
