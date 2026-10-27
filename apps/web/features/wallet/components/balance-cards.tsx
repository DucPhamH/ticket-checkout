import { Hourglass, RotateCcw, Wallet, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { BalancesDto } from '@tc/shared';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

type BalanceItem = { key: keyof BalancesDto; icon: LucideIcon; tone: string; highlight?: boolean };

const ITEMS: BalanceItem[] = [
  { key: 'available', icon: Wallet, tone: 'bg-white/15 text-white', highlight: true },
  { key: 'pending', icon: Hourglass, tone: 'bg-amber-50 text-amber-600' },
  { key: 'refundPending', icon: RotateCcw, tone: 'bg-sky-50 text-sky-600' },
];

export async function BalanceCards({ balances, locale }: { balances: BalancesDto; locale: string }) {
  const t = await getTranslations('wallet');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ITEMS.map(({ key, icon: Icon, tone, highlight }) => (
        <div
          key={key}
          className={cn(
            'min-w-0 rounded-2xl border p-4 shadow-sm',
            highlight && 'col-span-2 sm:col-span-1',
            highlight
              ? 'border-transparent bg-gradient-to-br from-brand-600 to-brand-800 text-white'
              : 'border-slate-200/70 bg-white',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
              <Icon className="size-4" />
            </span>
            <span className={cn('text-sm leading-tight font-medium', highlight ? 'text-white/85' : 'text-slate-600')}>
              {t(key)}
            </span>
          </div>
          <p className={cn('mt-3 font-bold tabular-nums', highlight ? 'text-3xl sm:text-2xl' : 'text-lg sm:text-2xl')}>
            {formatVnd(balances[key], locale)}
          </p>
          <p className={cn('mt-1 text-xs', highlight ? 'text-white/70' : 'text-slate-500')}>{t(`${key}Hint`)}</p>
        </div>
      ))}
    </div>
  );
}
