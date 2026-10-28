import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

/**
 * Cursors are opaque to clients: the sort key of the last item they saw, as base64url JSON.
 * Keyset pagination ("rows after this key") stays fast on deep pages and never skips or repeats
 * a row when new ones are inserted meanwhile, unlike OFFSET.
 */
export function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

// Query schema for `?limit=&cursor=`, decoding the cursor into the given key shape.
export function pageQuerySchema<K extends z.ZodType>(cursorKey: K) {
  return z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGE_LIMIT_MAX)
      .default(PAGE_LIMIT_DEFAULT)
      .meta({ description: `Page size, at most ${PAGE_LIMIT_MAX}`, example: PAGE_LIMIT_DEFAULT }),
    cursor: z
      .string()
      .optional()
      .transform((raw, ctx): z.output<K> | undefined => {
        if (raw === undefined) return undefined;
        try {
          return cursorKey.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
          return z.NEVER;
        }
      })
      .meta({ description: '`nextCursor` from the previous page; omit for the first page' }),
  });
}

/**
 * Turns `limit + 1` fetched rows into a page: the extra row only tells us another page exists.
 */
export function toPage<Row, Item>(
  rows: Row[],
  limit: number,
  toItem: (row: Row) => Item,
  keyOf: (row: Row) => Record<string, unknown>,
): { items: Item[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map(toItem),
    nextCursor: hasMore ? encodeCursor(keyOf(pageRows[pageRows.length - 1])) : null,
  };
}

// The response shape for OpenAPI.
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Pass as `cursor` for the next page; null on the last page' }),
  });
