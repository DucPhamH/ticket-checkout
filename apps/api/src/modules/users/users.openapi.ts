import { z } from 'zod';
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { errorResponse, jsonResponse } from '../../openapi/common';
import { UserSchema } from './users.schema';

export const usersPaths: ZodOpenApiPathsObject = {
  '/users': {
    get: {
      tags: ['Users'],
      summary: 'List demo users',
      description: 'Backs the user switcher. There is no authentication in this demo.',
      responses: {
        '200': jsonResponse('All users', z.array(UserSchema)),
      },
    },
  },
  '/me': {
    get: {
      tags: ['Users'],
      summary: 'Current user',
      description: 'Resolves the `X-User-Id` header to a user.',
      security: [{ userId: [] }],
      responses: {
        '200': jsonResponse('The current user', UserSchema),
        '401': errorResponse('Header missing or invalid (`MISSING_USER_ID`, `INVALID_USER_ID`, `UNKNOWN_USER`)'),
      },
    },
  },
};
