// Paths without the locale prefix; the i18n Link adds it.
export const ROUTES = {
  home: '/',
  event: (id: number) => `/events/${id}`,
  order: (id: number) => `/orders/${id}`,
  wallet: '/me',
  admin: '/admin',
} as const;
