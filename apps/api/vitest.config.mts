import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/setup/test-database';

export default defineConfig({
  test: {
    // Recreates the *_test database (migrations + seed) before the suite runs.
    globalSetup: ['./test/setup/global-setup.ts'],
    // Blocks real network calls in every test; tests mock the gateway's answers.
    setupFiles: ['./test/setup/no-network.ts'],
    restoreMocks: true,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      // Fake VNPay credentials: tests never sign with the real secret.
      VNP_TMN_CODE: 'TESTCODE',
      VNP_HASH_SECRET: 'TEST_SECRET_FOR_UNIT_TESTS_ONLY',
    },
    // Test files share the test database; running them one at a time keeps one file's fixtures
    // out of another file's assertions.
    fileParallelism: false,
  },
});
