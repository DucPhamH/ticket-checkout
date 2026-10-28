import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import {
  CreateOrderBodySchema,
  CreateOrderResponseSchema,
  MyOrdersQuerySchema,
  OrderIdParamsSchema,
  OrderPageSchema,
  OrderSchema,
} from './orders.schema';

export const ordersPaths: ZodOpenApiPathsObject = {
  '/orders': {
    post: {
      tags: ['Orders'],
      summary: 'Create an order and reserve its tickets',
      description:
        'Reserves the tickets for 15 minutes, creates a `PENDING` order and its `PENDING` payment, and returns ' +
        'the signed VNPay URL to send the buyer to. Amounts are computed by the api (price + 10% service fee) ' +
        "and frozen on the order. Send the buyer's IP in `X-Forwarded-For`.",
      security: [{ userId: [] }],
      requestBody: { content: { 'application/json': { schema: CreateOrderBodySchema } } },
      responses: {
        '201': jsonResponse('Order created, tickets reserved, payment opened', CreateOrderResponseSchema),
        '400': errorResponse('Invalid body (`VALIDATION_ERROR`, `INVALID_JSON`)'),
        '401': errorResponse('No valid `X-User-Id`'),
        '403': errorResponse('Admins cannot buy (`ADMIN_CANNOT_BUY`)'),
        '404': errorResponse('No such listing (`LISTING_NOT_FOUND`)'),
        '409': errorResponse('`OWN_LISTING`, `LISTING_NOT_ON_SALE` or `NOT_ENOUGH_TICKETS`'),
      },
    },
  },
  '/orders/{id}': {
    get: {
      tags: ['Orders'],
      summary: 'One of my orders',
      description: "Only the buyer can read an order; anyone else gets 404, so ids can't be probed.",
      security: [{ userId: [] }],
      requestParams: { path: OrderIdParamsSchema },
      responses: {
        '200': jsonResponse('The order', OrderSchema),
        '400': errorResponse('`id` is not a positive integer'),
        '401': errorResponse('No valid `X-User-Id`'),
        '404': errorResponse('No such order for this user (`ORDER_NOT_FOUND`)'),
      },
    },
  },
  '/me/orders': {
    get: {
      tags: ['Orders'],
      summary: 'My orders',
      description:
        'The current user’s orders, newest first, cursor-paginated. Reservations past their deadline are ' +
        'expired before listing.',
      security: [{ userId: [] }],
      requestParams: { query: MyOrdersQuerySchema },
      responses: {
        '200': jsonResponse('One page of orders', OrderPageSchema),
        '400': errorResponse('Bad `limit` or `cursor` (`VALIDATION_ERROR`)'),
        '401': errorResponse('No valid `X-User-Id`'),
      },
    },
  },
};
