import { Pool } from 'pg';
import { env } from '../config/env';

// Temporary: a plain pg pool for the health check. Replaced by Prisma in step 2.
export const pool = new Pool({ connectionString: env.DATABASE_URL });
