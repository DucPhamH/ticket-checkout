'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { withdrawListing, type WithdrawState } from '../actions';

export function WithdrawButton({ listingId }: { listingId: number }) {
  const t = useTranslations('sell');
  const [state, setState] = useState<WithdrawState | null>(null);

  if (state?.ok) return <p className="text-xs text-slate-500">{t('withdrawn')}</p>;

  return (
    <div className="space-y-1">
      <ConfirmButton
        danger
        label={t('withdraw')}
        confirmLabel={t('confirmWithdraw')}
        backLabel={t('back')}
        onConfirm={async () => setState(await withdrawListing(listingId))}
      />
      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-600">
          {t.has(`errors.${state.errorCode}`) ? t(`errors.${state.errorCode}`) : t('errors.UNKNOWN')}
        </p>
      )}
    </div>
  );
}
