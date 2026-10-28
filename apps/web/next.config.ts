import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Next 16 writes an AGENTS.md for AI coding tools on `next dev`; we don't want it in the repo.
  agentRules: false,
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  // Docker: `next build` emits a self-contained server with only the files it needs.
  output: 'standalone',
  // Trace from the monorepo root, so the workspace package (@tc/shared) is included.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default withNextIntl(nextConfig);
