import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Local dev database by default; DATABASE_URL overrides it (CI, or a throwaway database).
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://tc:tc@localhost:5432/tc',
      // Fake VNPay credentials: tests never sign with the real secret.
      VNP_TMN_CODE: 'TESTCODE',
      VNP_HASH_SECRET: 'TEST_SECRET_FOR_UNIT_TESTS_ONLY',
    },
    // Test files share one database and create their own fixtures; running them one at a time
    // keeps one file's fixtures out of another file's assertions.
    fileParallelism: false,
  },
});
