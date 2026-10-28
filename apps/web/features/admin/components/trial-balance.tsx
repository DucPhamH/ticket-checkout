import { getTranslations } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { TrialBalanceDto } from '@tc/shared';

// Balances as stored: + debit, − credit. The total comes from the api, which sums the ledger.
export async function TrialBalance({ trialBalance, locale }: { trialBalance: TrialBalanceDto; locale: string }) {
  const t = await getTranslations('admin');
  const sum = trialBalance.total;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trialBalance')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="mb-3 text-xs text-slate-500">{t('trialBalanceHint')}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="pb-2 font-medium">{t('account')}</th>
              <th className="pb-2 text-right font-medium">{t('balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trialBalance.accounts.map((row) => (
              <tr key={row.code}>
                <td className="py-2 font-mono text-xs break-all">{row.code}</td>
                <td className="py-2 text-right tabular-nums">{formatVnd(row.balance, locale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-bold">
              <td className="pt-2">{t('sum')}</td>
              <td className={cn('pt-2 text-right tabular-nums', sum === 0 ? 'text-emerald-600' : 'text-red-600')}>
                <span className="inline-flex items-center gap-1">
                  {sum === 0 && <CheckCircle2 className="size-4" />}
                  {formatVnd(sum, locale)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
