**Input validated in controllers with zod.** `Schema.parse(req.params)` returns typed values and
reuses the schema in the OpenAPI doc; the error handler turns `ZodError` into
`400 VALIDATION_ERROR` with the failing field (`id: ...`).

**An inactive event returns no listings.** Its page still loads (by id), but a completed or
cancelled event cannot be bought, so listing its tickets would mislead.
