import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { DATABASE_URL: 'postgresql://tc:tc@localhost:5432/tc' },
    // Test files share one database and create their own fixtures; running them one at a time
    // keeps one file's fixtures out of another file's assertions.
    fileParallelism: false,
  },
});
