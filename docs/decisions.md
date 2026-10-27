# Decisions

Choices the brief left open. Newest at the bottom.

**VNPay as the gateway.** See [Payments](05-payments.md#why-vnpay).

**Separate Express api instead of Next.js route handlers.** Keeps money logic out of the UI
process, matches "a Node.js backend" literally, and lets the api be tested without a browser.
Cost: one more service and an internal HTTP hop.

**Web calls the api only from the server.** No CORS, no api URL in the browser, the user cookie
stays on one origin.

**No authentication; current user in a cookie.** Allowed by the brief. Web forwards it as
`X-User-Id`. Anyone can impersonate anyone, which is fine for a demo and listed as not
production-ready.

**Money as integer VND.** No floats anywhere. Fees are computed on the order subtotal in basis
points, rounded half up; the platform's share is the remainder.

**Fees on the subtotal, not per ticket.** Fewer rounding steps and one source of truth.

**Tickets are reserved for 15 minutes** when an order is created, matching VNPay's
`vnp_ExpireDate`. Expired orders release their tickets.

**Platform fee recognised on completion.** Held in `fee_pending` until the event happens so a
cancellation can refund the buyer in full.

**Late payments are refunded, not dropped.** See [Payments](05-payments.md#ipn-handling).

**ngrok with a fixed domain over a Cloudflare quick tunnel.** VNPay's IPN URL is configured per
merchant, so it must not change between runs. ngrok's free plan includes one fixed domain;
Cloudflare needs a purchased domain for that.

**Extra scope: cancel event + refunds, seller-created listings.** Not required; added because
they exercise the ledger in both directions.

**Feature-based folders with an enforced import rule.** See [Frontend](04-frontend.md#the-import-rule).

**ESLint 9, not 10.** `eslint-plugin-import` does not support ESLint 10 yet.

**Next.js agent files disabled** (`agentRules: false`). Next 16 writes `AGENTS.md` on `next dev`;
we don't keep generated tool files in the repo.
