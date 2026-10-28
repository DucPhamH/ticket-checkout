import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { TrialBalanceSchema } from './admin.schema';

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
};
