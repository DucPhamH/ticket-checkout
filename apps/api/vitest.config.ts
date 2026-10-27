import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { DATABASE_URL: 'postgresql://tc:tc@localhost:5432/tc' },
  },
});
