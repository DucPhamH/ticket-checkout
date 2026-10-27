import { z } from 'zod';
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { jsonResponse } from '../../openapi/common';
import { EventSummarySchema } from './events.schema';

export const eventsPaths: ZodOpenApiPathsObject = {
  '/events': {
    get: {
      tags: ['Events'],
      summary: 'Events on sale',
      description:
        'Active events, soonest first. `minPrice` and `ticketsAvailable` only count listings that are active and not sold out.',
      responses: {
        '200': jsonResponse('Active events', z.array(EventSummarySchema)),
      },
    },
  },
};
