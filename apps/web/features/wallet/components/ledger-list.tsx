import { BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { LedgerLineDto } from '@tc/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { formatDateTime, formatVnd } from '@/lib/format';

// For the user's liability accounts a credit (negative amount) increases what we owe them,
// so the sign is flipped for display: + means "money in" for the user.
export async function LedgerList({ lines, locale }: { lines: LedgerLineDto[]; locale: string }) {
  const t = await getTranslations('wallet');
  if (lines.length === 0) return <EmptyState icon={BookOpen} title={t('noLedger')} />;

  return (
    <ul className="divide-y divide-slate-100">
      {lines.map((line) => {
        const delta = -line.amount;
        return (
          <li key={line.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">
                {t.has(`ledgerKind.${line.kind}`) ? t(`ledgerKind.${line.kind}`) : line.kind}
                {line.orderId && <span className="text-slate-400"> · #{line.orderId}</span>}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-500">
                {line.account} · {formatDateTime(line.createdAt, locale)}
              </p>
            </div>
            <span
              className={cn('text-sm font-semibold tabular-nums', delta >= 0 ? 'text-emerald-600' : 'text-slate-500')}
            >
              {delta >= 0 ? '+' : '−'}
              {formatVnd(Math.abs(delta), locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
