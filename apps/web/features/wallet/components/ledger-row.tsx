import { useTranslations } from 'next-intl';
import type { LedgerLineDto } from '@tc/shared';
import { cn } from '@/lib/cn';
import { formatDateTime, formatVnd } from '@/lib/format';

// For the user's liability accounts a credit (negative amount) increases what we owe them,
// so the sign is flipped for display: + means "money in" for the user.
export function LedgerRow({ line, locale }: { line: LedgerLineDto; locale: string }) {
  const t = useTranslations('wallet');
  const delta = -line.amount;
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {t(`ledgerKind.${line.kind}`)}
          {line.orderId && <span className="text-slate-400"> · #{line.orderId}</span>}
        </p>
        <p className="truncate font-mono text-[11px] text-slate-500">
          {line.account} · {formatDateTime(line.createdAt, locale)}
        </p>
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', delta >= 0 ? 'text-emerald-600' : 'text-slate-500')}>
        {delta >= 0 ? '+' : '−'}
        {formatVnd(Math.abs(delta), locale)}
      </span>
    </li>
  );
}
