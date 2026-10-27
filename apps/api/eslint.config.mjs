import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: { globals: globals.node },
    settings: { 'import/resolver': { typescript: true, node: true } },
    rules: {
      // Catches "phantom" deps that only resolve thanks to the hoisted root node_modules.
      'import/no-extraneous-dependencies': [
        'error',
        { packageDir: [import.meta.dirname], devDependencies: ['test/**', '*.config.*'] },
      ],
      // The api never reaches into the web app.
      'import/no-restricted-paths': ['error', { zones: [{ target: './src', from: '../web' }] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  globalIgnores(['dist/**']),
]);
