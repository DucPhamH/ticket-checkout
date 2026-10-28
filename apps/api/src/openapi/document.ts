import { createDocument } from 'zod-openapi';
import { env } from '../config/env';
import { adminPaths } from '../modules/admin/admin.openapi';
import { eventsPaths } from '../modules/events/events.openapi';
import { healthPaths } from '../modules/health/health.openapi';
import { listingsPaths } from '../modules/listings/listings.openapi';
import { ordersPaths } from '../modules/orders/orders.openapi';
import { paymentsPaths } from '../modules/payments/payments.openapi';
import { usersPaths } from '../modules/users/users.openapi';
import { walletPaths } from '../modules/wallet/wallet.openapi';
import { USER_ID_HEADER } from '../constants/http';
import { ErrorResponseSchema } from './common';

// Built from the same zod schemas the routes use, so the docs cannot drift from the code.
// Each module contributes its own paths; add new modules here.
export const openApiDocument = createDocument(
  {
    openapi: '3.1.0',
    info: {
      title: 'Ticket Checkout API',
      version: '0.1.0',
      description:
        'Backend for the ticket resale checkout: events, listings, orders, VNPay payments and the escrow ledger.\n\n' +
        'Money is in whole VND (integers). Errors always use the `ErrorResponse` shape.',
    },
    servers: [{ url: env.API_PUBLIC_URL, description: 'This api' }],
    tags: [
      { name: 'System', description: 'Operational endpoints' },
      { name: 'Users', description: 'Demo users and the current user' },
      { name: 'Events', description: 'Events and the tickets listed for them' },
      { name: 'Listings', description: 'Selling tickets' },
      { name: 'Orders', description: 'Buying tickets' },
      { name: 'Payments', description: 'VNPay redirects and notifications' },
      { name: 'Wallet', description: 'The current user’s balances and history, from the ledger' },
      { name: 'Admin', description: 'Admin only: event settlement and ledger checks' },
    ],
    paths: {
      ...healthPaths,
      ...usersPaths,
      ...eventsPaths,
      ...listingsPaths,
      ...ordersPaths,
      ...paymentsPaths,
      ...walletPaths,
      ...adminPaths,
    },
    components: {
      schemas: { ErrorResponse: ErrorResponseSchema },
      // Swagger UI shows an "Authorize" button to set the demo user once for all requests.
      securitySchemes: {
        userId: { type: 'apiKey', in: 'header', name: USER_ID_HEADER, description: 'Demo user id (no real auth)' },
      },
    },
  },
  {
    // zod emits a long validation regex for ISO datetimes; `format: date-time` already says it.
    override: ({ jsonSchema }) => {
      if (jsonSchema.format === 'date-time') delete jsonSchema.pattern;
    },
  },
);
