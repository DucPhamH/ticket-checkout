// Tests run against their own database, "<name>_test" next to the dev database (tc -> tc_test),
// rebuilt from scratch on every run. The dev database is never touched by tests.
const BASE_URL = process.env.DATABASE_URL ?? 'postgresql://tc:tc@localhost:5432/tc';

export function testDatabaseUrl(): string {
  const url = new URL(BASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;
  return url.toString();
}
