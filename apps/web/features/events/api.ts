import 'server-only';
import type { EventDetailDto, EventSummaryDto } from '@tc/shared';
import { ApiError, apiRequest } from '@/lib/api-client';

export function listEvents(): Promise<EventSummaryDto[]> {
  return apiRequest<EventSummaryDto[]>('/events');
}

// Null when the event does not exist (or the id is malformed), so the page can show "not found".
export async function getEvent(id: string): Promise<EventDetailDto | null> {
  try {
    return await apiRequest<EventDetailDto>(`/events/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
