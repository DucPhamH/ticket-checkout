import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next 16 "proxy" (formerly middleware): redirects / to /vi and keeps the locale prefix.
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
