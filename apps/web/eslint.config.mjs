import { readdirSync } from 'node:fs';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Architecture rule (bulletproof-react): dependencies flow one way, shared → features → app.
const features = readdirSync(new URL('./features', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const SHARED = ['./components', './lib', './constants', './i18n'];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Shared code knows nothing about features or pages.
            ...SHARED.map((target) => ({
              target,
              from: ['./features', './app'],
              message:
                'Shared code must not import from features/ or app/. Move the code to shared or compose it in app/.',
            })),
            // Features never import pages.
            { target: './features', from: './app', message: 'Features must not import from app/.' },
            // Features never import each other; compose them in app/ instead.
            ...features.map((feature) => ({
              target: `./features/${feature}`,
              from: './features',
              except: [`./${feature}`],
              message: 'Do not import across features. Compose them in app/ or move shared code to components/ / lib/.',
            })),
          ],
        },
      ],
      // Catches "phantom" deps: importing a package this workspace does not declare
      // works locally (hoisted node_modules) but breaks in the Docker image.
      'import/no-extraneous-dependencies': ['error', { packageDir: [import.meta.dirname] }],
      // Leading underscore marks an intentionally unused variable.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts']),
]);
