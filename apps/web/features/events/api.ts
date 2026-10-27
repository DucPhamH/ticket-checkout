import 'server-only';
import type { EventDetailDto, EventSummaryDto } from '@tc/shared';
import { apiRequest } from '@/lib/api-client';
import { MOCK_EVENTS } from '@/mocks/data';

export function listEvents(): Promise<EventSummaryDto[]> {
  return apiRequest<EventSummaryDto[]>('/events');
}

// Still mock data: the event detail API comes in the next commit.
export async function getEvent(id: number): Promise<EventDetailDto | null> {
  return MOCK_EVENTS.find((event) => event.id === id) ?? null;
}
