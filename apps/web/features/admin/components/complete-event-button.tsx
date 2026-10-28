'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { formatVnd } from '@/lib/format';
import { completeEvent, type CompleteEventState } from '../actions';

// Two steps instead of a browser confirm(): the first click asks, the second one releases the escrow.
export function CompleteEventButton({ eventId, locale }: { eventId: number; locale: string }) {
  const t = useTranslations('admin');
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<CompleteEventState | null>(null);
  const [pending, startTransition] = useTransition();

  if (state?.ok) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700">
        <CheckCircle2 className="size-4 shrink-0" />
        {t('completed', {
          orders: state.result.settledOrders,
          payouts: formatVnd(state.result.sellerPayouts, locale),
          revenue: formatVnd(state.result.platformRevenue, locale),
        })}
      </p>
    );
  }

  const run = () => startTransition(async () => setState(await completeEvent(eventId)));

  return (
    <div className="space-y-1">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={run} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('confirmComplete')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            {t('back')}
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setConfirming(true)}>
          {t('complete')}
        </Button>
      )}
      {confirming && <p className="text-xs text-slate-500">{t('completeHint')}</p>}
      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-600">
          {t.has(`errors.${state.errorCode}`) ? t(`errors.${state.errorCode}`) : t('errors.UNKNOWN')}
        </p>
      )}
    </div>
  );
}
