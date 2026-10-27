import 'server-only';
import type { EventDetailDto, EventSummaryDto } from '@tc/shared';
import { MOCK_EVENTS } from '@/mocks/data';

export async function listEvents(): Promise<EventSummaryDto[]> {
  return MOCK_EVENTS.map(({ listings: _listings, description: _description, ...summary }) => summary);
}

export async function getEvent(id: number): Promise<EventDetailDto | null> {
  return MOCK_EVENTS.find((event) => event.id === id) ?? null;
}
