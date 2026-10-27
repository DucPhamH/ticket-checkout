'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function select(next: Locale) {
    // pathname has no locale prefix and already contains dynamic segments (e.g. /events/1).
    router.replace(pathname, { locale: next });
  }

  return (
    <div role="group" aria-label={t('language')} className="flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => select(code)}
          aria-pressed={locale === code}
          className={cn(
            'rounded-full px-2.5 py-1 uppercase transition',
            locale === code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
