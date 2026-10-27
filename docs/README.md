# Architecture docs

Read in order if you are new to the codebase.

1. [Overview](01-overview.md) – what runs where and how a request flows
2. [Monorepo](02-monorepo.md) – workspaces, the shared package, Docker builds
3. [Backend](03-backend.md) – Express module layout and error handling
4. [Frontend](04-frontend.md) – feature folders, the import rule, i18n
5. [Payments](05-payments.md) – VNPay redirect, IPN, reconciliation
6. [Ledger](06-ledger.md) – accounts, postings, invariants
7. [Database](07-database.md) – tables, constraints, indexes, seed
8. [Decisions](decisions.md) – choices the brief left open, and why

Docs describe the design. Where something is designed but not built yet, the doc says so.
