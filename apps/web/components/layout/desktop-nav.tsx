'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isActive } from './nav-items';

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(pathname, item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
