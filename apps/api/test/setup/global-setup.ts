import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { testDatabaseUrl } from './test-database';

/**
 * Runs once before the whole test suite: drops and recreates the test database, applies every
 * migration and seeds it. Each run starts from the same clean state, and tests are free to write
 * ledger rows (which can never be deleted) without polluting the dev database.
 */
export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const name = url.pathname.slice(1);
  // Safety catch: this function drops a database, so it only ever touches one named *_test.
  if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error(`Refusing to recreate "${name}": not a *_test database`);

  const server = new URL(url);
  server.pathname = '/postgres'; // connect to the maintenance database to drop/create the test one
  const client = new Client({ connectionString: server.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();

  const env = { ...process.env, DATABASE_URL: url.toString() };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx prisma db seed', { env, stdio: 'pipe' });
}
