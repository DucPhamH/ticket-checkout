import { z } from 'zod';
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { EventDetailSchema, EventIdParamsSchema, EventSummarySchema } from './events.schema';

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
  '/events/{id}': {
    get: {
      tags: ['Events'],
      summary: 'One event with its listings',
      description: 'Any status. Listings are only included while the event is active.',
      requestParams: { path: EventIdParamsSchema },
      responses: {
        '200': jsonResponse('The event', EventDetailSchema),
        '400': errorResponse('`id` is not a positive integer (`VALIDATION_ERROR`)'),
        '404': errorResponse('No such event (`EVENT_NOT_FOUND`)'),
      },
    },
  },
};
