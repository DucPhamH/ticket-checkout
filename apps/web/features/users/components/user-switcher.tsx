'use client';

import { useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UserDto } from '@tc/shared';
import { switchUser } from '../actions';
import { useRouter } from '@/i18n/navigation';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

export function UserSwitcher({ users, currentUser }: { users: UserDto[]; currentUser: UserDto }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const userId = Number(event.target.value);
    startTransition(async () => {
      await switchUser(userId);
      router.refresh();
    });
  }

  return (
    <label
      className={cn(
        'relative flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-8 pl-1 text-sm transition hover:border-slate-300',
        isPending && 'opacity-60',
      )}
    >
      <Avatar name={currentUser.name} className="size-7 text-xs" />
      <span className="sr-only">{t('switchUser')}</span>
      <span className="max-w-24 truncate font-medium sm:max-w-none">{currentUser.name}</span>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-slate-400" />
      {/* Native select on top: best UX on phones (OS picker), fully accessible. */}
      <select
        value={currentUser.id}
        onChange={onChange}
        disabled={isPending}
        aria-label={t('switchUser')}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  );
}
