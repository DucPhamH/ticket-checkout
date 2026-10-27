'use server';

import { cookies } from 'next/headers';
import { CURRENT_USER_COOKIE } from './constants';

export async function switchUser(userId: number) {
  (await cookies()).set(CURRENT_USER_COOKIE, String(userId), { path: '/', sameSite: 'lax', httpOnly: true });
}
