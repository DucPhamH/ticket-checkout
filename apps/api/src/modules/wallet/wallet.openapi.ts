import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { BalancesSchema, LedgerPageSchema, MyLedgerQuerySchema } from './wallet.schema';

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
  '/me/ledger': {
    get: {
      tags: ['Wallet'],
      summary: 'My ledger lines',
      description:
        'Every ledger line on the current user’s accounts, newest first, cursor-paginated. ' +
        'Amounts are signed as stored: + debit, − credit (a credit increases what we owe the user).',
      security: [{ userId: [] }],
      requestParams: { query: MyLedgerQuerySchema },
      responses: {
        '200': jsonResponse('One page of ledger lines', LedgerPageSchema),
        '400': errorResponse('Bad `limit` or `cursor` (`VALIDATION_ERROR`)'),
        '401': errorResponse('No valid `X-User-Id`'),
      },
    },
  },
};
