import 'server-only';
import type { ApiErrorBody } from '@tc/shared';
import { API_INTERNAL_URL, USER_ID_HEADER } from '@/constants/api';
import { getSessionUserId } from './session';

// An error response from the api, carrying its stable `code` (e.g. LISTING_SOLD_OUT).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  // Defaults to the session user; pass a number to act as someone else (e.g. a fallback).
  userId?: number;
};

// Server-side fetch to the api. Always sends the current user and never caches.
export async function apiRequest<T>(path: string, { method = 'GET', body, userId }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_INTERNAL_URL}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      [USER_ID_HEADER]: String(userId ?? (await getSessionUserId())),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, payload?.error.code ?? 'UNKNOWN', payload?.error.message ?? res.statusText);
  }
  return (await res.json()) as T;
}
