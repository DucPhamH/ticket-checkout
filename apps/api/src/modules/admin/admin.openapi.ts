import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { AdminEventPageSchema, AdminEventsQuerySchema, TrialBalanceSchema } from './admin.schema';

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
};
