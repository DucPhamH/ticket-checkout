import type { User } from '../generated/prisma/client';

// Set by the currentUser middleware; only present on routes that use it.
declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: User;
  }
}
