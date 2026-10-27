# Frontend (apps/web)

Next.js 16 App Router, Tailwind v4, next-intl. Structure follows
[bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
and the "split by feature" option in the
[Next.js docs](https://nextjs.org/docs/app/getting-started/project-structure).

```
app/[locale]/...        routes; pages fetch data and compose features
app/[locale]/_components/  app-level pieces that combine several features (SiteHeader)
components/ui/          primitives: Button, Card, Badge, Money, QuantityStepper...
components/layout/      Container, nav, locale switcher
components/pricing/     PriceBreakdown (used by checkout and orders)
constants/              app-wide constants (routes, event status colours)
lib/                    cn(), formatting
features/<feature>/
  components/           UI owned by this feature
  api.ts                server-only data access
  actions.ts            server actions (mutations)
  constants.ts
i18n/, messages/        locales and all user-facing strings
mocks/                  design-phase fixtures, removed once api.ts calls the real api
```

Features: `events`, `checkout`, `orders`, `wallet`, `admin`, `users`.

## The import rule

Dependencies point one way: **shared -> features -> app**.

- `components/`, `lib/`, `constants/` never import from `features/` or `app/`.
- A feature never imports another feature. If two features need something, it moves to shared;
  if a page needs two features, the page composes them (the wallet page renders
  `orders/OrderList` next to `wallet/BalanceCards`).
- No barrel `index.ts` files; import the file you need.

This is enforced by `import/no-restricted-paths` in `eslint.config.mjs`, so a violation fails
`npm run lint` with a message explaining where the code should go.

## Data fetching

Pages are Server Components. They call `features/*/api.ts`, which is marked `server-only` and
calls the api over the internal Docker network. The browser never sees the api URL. Pages are
rendered per request (`ƒ` in the build output), so listings and order status are always fresh.

Mutations (create order, switch user, admin actions) are Server Actions in
`features/*/actions.ts`.

The order result page polls by calling `router.refresh()` every few seconds while the order is
`PENDING`; the server re-reads the order each time.

## i18n

`/vi/...` and `/en/...`; `/` redirects to `/vi` (`proxy.ts`). Every user-facing string lives in
`messages/vi.json` and `messages/en.json`, which have identical keys. Money and dates are
formatted with `Intl` in the `Asia/Ho_Chi_Minh` time zone.

## Mobile

Layouts are mobile-first. On phones the nav is a bottom tab bar and checkout is a bottom sheet
above it; from `md` up the nav moves to the header and checkout becomes a sticky side card.
Native `<select>` is used for the user switcher so phones get the OS picker.
