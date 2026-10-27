import 'server-only';
import { cookies } from 'next/headers';
import { CURRENT_USER_COOKIE, DEFAULT_USER_ID } from '@/constants/session';

export async function getSessionUserId(): Promise<number> {
  const id = Number((await cookies()).get(CURRENT_USER_COOKIE)?.value);
  return Number.isSafeInteger(id) && id > 0 ? id : DEFAULT_USER_ID;
}
