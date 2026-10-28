import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { EventIdParamsSchema } from '../events/events.schema';
import {
  AdminEventPageSchema,
  AdminEventsQuerySchema,
  CompleteEventResultSchema,
  TrialBalanceSchema,
} from './admin.schema';

const adminErrors = {
  '401': errorResponse('No valid `X-User-Id`'),
  '403': errorResponse('The user is not an admin (`ADMIN_ONLY`)'),
};

export const adminPaths: ZodOpenApiPathsObject = {
  '/admin/trial-balance': {
    get: {
      tags: ['Admin'],
      summary: 'Trial balance',
      description:
        'Every ledger account with its balance (+ debit, − credit) and the total, which must be 0. ' +
        'Computed from the ledger entries on every request.',
      security: [{ userId: [] }],
      responses: { '200': jsonResponse('All accounts and their total', TrialBalanceSchema), ...adminErrors },
    },
  },
  '/admin/events': {
    get: {
      tags: ['Admin'],
      summary: 'All events with their paid sales',
      description: 'Every event in any status, soonest first, cursor-paginated, with its paid (not refunded) orders.',
      security: [{ userId: [] }],
      requestParams: { query: AdminEventsQuerySchema },
      responses: {
        '200': jsonResponse('One page of events', AdminEventPageSchema),
        '400': errorResponse('Bad `limit` or `cursor` (`VALIDATION_ERROR`)'),
        ...adminErrors,
      },
    },
  },
  '/admin/events/{id}/complete': {
    post: {
      tags: ['Admin'],
      summary: 'Mark an event as taken place and release its escrow',
      description:
        'Sets the event to `COMPLETED` and, for every paid order, posts `EVENT_SETTLED`: the seller’s payout ' +
        'moves from pending to available and the fee from pending to revenue. Idempotent: repeating it settles ' +
        'nothing new. A payment that arrives afterwards is refunded instead of entering escrow.',
      security: [{ userId: [] }],
      requestParams: { path: EventIdParamsSchema },
      responses: {
        '200': jsonResponse('What this request settled', CompleteEventResultSchema),
        '400': errorResponse('`id` is not a positive integer'),
        ...adminErrors,
        '404': errorResponse('No such event (`EVENT_NOT_FOUND`)'),
        '409': errorResponse('The event was cancelled (`EVENT_CANCELLED`)'),
      },
    },
  },
};
