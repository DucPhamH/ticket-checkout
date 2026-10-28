**Unpaid orders expire in-process, not with a separate worker or cron.** A 60-second sweep inside
the api plus expiry on read and before reserving keeps tickets available without extra
infrastructure. It is idempotent, so running several api instances is safe; at larger scale it
would move to a dedicated worker or a database-scheduled job.
