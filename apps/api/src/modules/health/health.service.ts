import type { HealthResponse } from '@tc/shared';
import { pool } from '../../db/pool';

export async function getHealth(): Promise<HealthResponse> {
  let db: HealthResponse['db'] = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'down';
  }
  return { status: 'ok', db, time: new Date().toISOString() };
}
