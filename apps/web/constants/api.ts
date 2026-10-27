// Web calls the api from the server only. Docker sets http://api:4000; local dev falls back to localhost.
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export const USER_ID_HEADER = 'X-User-Id';
