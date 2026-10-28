import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import {
  CreateListingBodySchema,
  ListingIdParamsSchema,
  MyListingPageSchema,
  MyListingSchema,
  MyListingsQuerySchema,
} from './listings.schema';

export const listingsPaths: ZodOpenApiPathsObject = {
  '/listings': {
    post: {
      tags: ['Listings'],
      summary: 'Put tickets on sale',
      description:
        'Creates an `ACTIVE` listing for an event that is still on sale and has not started. Price in VND, ' +
        '10,000 to 100,000,000 in steps of 1,000; at most 50 tickets.',
      security: [{ userId: [] }],
      requestBody: { content: { 'application/json': { schema: CreateListingBodySchema } } },
      responses: {
        '201': jsonResponse('The new listing', MyListingSchema),
        '400': errorResponse('Invalid body (`VALIDATION_ERROR`, `INVALID_JSON`)'),
        '401': errorResponse('No valid `X-User-Id`'),
        '403': errorResponse('Admins cannot sell (`ADMIN_CANNOT_SELL`)'),
        '404': errorResponse('No such event (`EVENT_NOT_FOUND`)'),
        '409': errorResponse('The event is completed, cancelled or has started (`EVENT_NOT_ON_SALE`)'),
      },
    },
  },
  '/listings/{id}/withdraw': {
    post: {
      tags: ['Listings'],
      summary: 'Take my listing off sale',
      description:
        'Sets the listing to `WITHDRAWN`. Orders already holding its tickets keep them and can still be paid. ' +
        'Repeating it is harmless.',
      security: [{ userId: [] }],
      requestParams: { path: ListingIdParamsSchema },
      responses: {
        '200': jsonResponse('The listing, now withdrawn', MyListingSchema),
        '400': errorResponse('`id` is not a positive integer'),
        '401': errorResponse('No valid `X-User-Id`'),
        '404': errorResponse('No such listing of mine (`LISTING_NOT_FOUND`)'),
      },
    },
  },
  '/me/listings': {
    get: {
      tags: ['Listings'],
      summary: 'My listings',
      description: 'The current user’s listings, newest first, cursor-paginated, with tickets reserved and sold.',
      security: [{ userId: [] }],
      requestParams: { query: MyListingsQuerySchema },
      responses: {
        '200': jsonResponse('One page of listings', MyListingPageSchema),
        '400': errorResponse('Bad `limit` or `cursor` (`VALIDATION_ERROR`)'),
        '401': errorResponse('No valid `X-User-Id`'),
      },
    },
  },
};
