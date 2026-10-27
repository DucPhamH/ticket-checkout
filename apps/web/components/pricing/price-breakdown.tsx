'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { OrderAmounts } from '@tc/shared';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

type PriceBreakdownProps = {
  unitPrice: number;
  quantity: number;
  amounts: Pick<OrderAmounts, 'subtotal' | 'buyerFee' | 'total'>;
  className?: string;
};

export function PriceBreakdown({ unitPrice, quantity, amounts, className }: PriceBreakdownProps) {
  const t = useTranslations('checkout');
  const locale = useLocale();

  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between gap-4 text-slate-600">
        <dt>{t('subtotal', { quantity, price: formatVnd(unitPrice, locale) })}</dt>
        <dd>
          <Money amount={amounts.subtotal} />
        </dd>
      </div>
      <div className="flex justify-between gap-4 text-slate-600">
        <dt>{t('serviceFee')}</dt>
        <dd>
          <Money amount={amounts.buyerFee} />
        </dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-dashed border-slate-200 pt-2 text-base font-bold text-slate-900">
        <dt>{t('total')}</dt>
        <dd>
          <Money amount={amounts.total} />
        </dd>
      </div>
    </dl>
  );
}
