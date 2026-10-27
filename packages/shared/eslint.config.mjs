import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

// shared is consumed by both the browser and the server: it has no runtime dependencies,
// so any third-party import (Prisma, React, process.env…) is a mistake.
export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    files: ['src/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { packageDir: [import.meta.dirname], devDependencies: false }],
      'no-restricted-globals': ['error', { name: 'process', message: 'shared must not read env vars or secrets.' }],
    },
  },
  globalIgnores(['dist/**']),
]);
