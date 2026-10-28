'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { withdrawListing, type WithdrawState } from '../actions';

// Two steps instead of a browser confirm(): the first click asks, the second one withdraws.
export function WithdrawButton({ listingId }: { listingId: number }) {
  const t = useTranslations('sell');
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<WithdrawState | null>(null);
  const [pending, startTransition] = useTransition();

  if (state?.ok) return <p className="text-xs text-slate-500">{t('withdrawn')}</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            aria-busy={pending}
            onClick={() => startTransition(async () => setState(await withdrawListing(listingId)))}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('confirmWithdraw')}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            {t('back')}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          {t('withdraw')}
        </Button>
      )}
      {state && !state.ok && (
        <p role="alert" className="w-full text-xs text-red-600">
          {t.has(`errors.${state.errorCode}`) ? t(`errors.${state.errorCode}`) : t('errors.UNKNOWN')}
        </p>
      )}
    </div>
  );
}
