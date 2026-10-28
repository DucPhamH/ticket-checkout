## Background jobs

`jobs/order-expiry.job.ts` sweeps unpaid orders past their 15-minute reservation once at startup
and then every 60 seconds: they become `EXPIRED` and their tickets go back on sale. The same
function also runs for one order when it is read (`GET /orders/:id`) and for one listing right
before a reservation, so nobody waits for the next sweep.

Expiring is a single SQL statement (`modules/orders/order-expiry.ts`): a `WITH` query that expires
the orders, adds their tickets up per listing and puts them back on sale. Measured on 1M orders,
1,000 stale orders across 1,000 listings take ~22 ms (one UPDATE per listing took ~550 ms). Rows are picked with `FOR UPDATE SKIP LOCKED` in batches of 1,000 (one transaction per batch), so
the sweep never waits on an order another transaction is holding and never holds many locks for
long. It only matches `PENDING` orders, so running it twice, or from several api instances at once,
never releases tickets twice (tests run three sweeps in parallel, hold a lock to prove it is
skipped, and check batching). If it ever tried, the
`quantity_available <= quantity_total` check would reject it.
