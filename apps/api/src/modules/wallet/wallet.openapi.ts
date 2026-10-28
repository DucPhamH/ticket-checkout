import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { BalancesSchema } from './wallet.schema';

export const walletPaths: ZodOpenApiPathsObject = {
  '/me/balances': {
    get: {
      tags: ['Wallet'],
      summary: 'My balances',
      description: 'Pending (escrow), available and refund-pending balances, summed from the ledger on every request.',
      security: [{ userId: [] }],
      responses: {
        '200': jsonResponse('The current user’s balances in VND', BalancesSchema),
        '401': errorResponse('Header missing or invalid (`MISSING_USER_ID`, `INVALID_USER_ID`, `UNKNOWN_USER`)'),
      },
    },
  },
};
