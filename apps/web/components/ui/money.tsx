'use client';

import { useLocale } from 'next-intl';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/cn';

// Client-safe money display. Server components can use formatVnd directly.
export function Money({ amount, className }: { amount: number; className?: string }) {
  const locale = useLocale();
  return <span className={cn('tabular-nums', className)}>{formatVnd(amount, locale)}</span>;
}
