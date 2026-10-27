import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { jsonResponse } from '../../openapi/common';
import { HealthResponseSchema } from './health.schema';

export const healthPaths: ZodOpenApiPathsObject = {
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Liveness and database check',
      description: 'Always 200 while the process is up; `db` reports whether Postgres answered.',
      responses: {
        '200': jsonResponse('Service is running', HealthResponseSchema),
      },
    },
  },
};
