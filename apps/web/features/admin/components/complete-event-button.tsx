'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { formatVnd } from '@/lib/format';
import { completeEvent, type CompleteEventState } from '../actions';
import { ActionError } from './action-error';

export function CompleteEventButton({ eventId, locale }: { eventId: number; locale: string }) {
  const t = useTranslations('admin');
  const [state, setState] = useState<CompleteEventState | null>(null);

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

  return (
    <div className="space-y-1">
      <ConfirmButton
        label={t('complete')}
        confirmLabel={t('confirmComplete')}
        backLabel={t('back')}
        hint={t('completeHint')}
        onConfirm={async () => setState(await completeEvent(eventId))}
      />
      {state && !state.ok && <ActionError code={state.errorCode} />}
    </div>
  );
}
