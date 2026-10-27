import 'server-only';
import { cookies } from 'next/headers';
import type { UserDto } from '@tc/shared';
import { MOCK_USERS } from '@/mocks/data';
import { CURRENT_USER_COOKIE, DEFAULT_USER_ID } from './constants';

export async function listUsers(): Promise<UserDto[]> {
  return MOCK_USERS;
}

// No real auth (allowed by the brief): the selected user id lives in a cookie.
export async function getCurrentUser(): Promise<UserDto> {
  const users = await listUsers();
  const id = Number((await cookies()).get(CURRENT_USER_COOKIE)?.value ?? DEFAULT_USER_ID);
  return users.find((user) => user.id === id) ?? users.find((user) => user.id === DEFAULT_USER_ID) ?? users[0];
}
