import { Prisma } from '../../generated/prisma/client';
import type { EventStatus } from '../../generated/prisma/enums';

/**
 * Locks an event row for the rest of the transaction and returns its current status (null if it
 * does not exist).
 *
 * - 'update' (exclusive): completing or cancelling the event. Waits for every 'share' holder.
 * - 'share': buying a ticket or applying a payment. Many can hold it at once, but none while
 *   the event is being completed or cancelled, so no money lands in escrow after it was settled.
 */
export async function lockEvent(
  tx: Prisma.TransactionClient,
  eventId: number,
  mode: 'share' | 'update',
): Promise<EventStatus | null> {
  const lock = mode === 'update' ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`;
  const rows = await tx.$queryRaw<{ status: EventStatus }[]>`
    SELECT status FROM events WHERE id = ${eventId} ${lock}
  `;
  return rows[0]?.status ?? null;
}
