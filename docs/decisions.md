**Overselling is prevented by one conditional UPDATE**
(`quantity_available = quantity_available - n WHERE quantity_available >= n`) inside the order
transaction; Postgres locks the row, so concurrent buyers are serialised. Tests fire 2 and 10
simultaneous requests at the last tickets, and fail if the reservation is rewritten as
read-then-write.

**Admins cannot buy** (403 `ADMIN_CANNOT_BUY`): the admin is an operator account. **Sellers cannot
buy their own listing** (409 `OWN_LISTING`). **At most 10 tickets per order**, shared by the UI
stepper and the api.

**Someone else's order is a 404, not a 403**, so order ids cannot be probed.

**API test files run one at a time** against the shared dev database, each creating and removing
its own tagged fixtures.
