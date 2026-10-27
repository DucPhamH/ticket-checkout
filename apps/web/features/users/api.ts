import 'server-only';
import type { UserDto } from '@tc/shared';
import { DEFAULT_USER_ID } from '@/constants/session';
import { ApiError, apiRequest } from '@/lib/api-client';

export function listUsers(): Promise<UserDto[]> {
  return apiRequest<UserDto[]>('/users');
}

export async function getCurrentUser(): Promise<UserDto> {
  try {
    return await apiRequest<UserDto>('/me');
  } catch (error) {
    // A stale cookie (e.g. after the database was reset) falls back to the default user.
    if (error instanceof ApiError && error.status === 401) {
      return apiRequest<UserDto>('/me', { userId: DEFAULT_USER_ID });
    }
    throw error;
  }
}
