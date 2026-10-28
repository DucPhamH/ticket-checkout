'use client';

import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { cancelEvent, type CancelEventState } from '../actions';
import { ActionError } from './action-error';

export function CancelEventButton({ eventId }: { eventId: number }) {
  const t = useTranslations('admin');
  const [state, setState] = useState<CancelEventState | null>(null);

  if (state?.ok) {
    const { cancelledOrders, refundsFailed } = state.result;
    return (
      <p
        role="status"
        className={
          refundsFailed > 0
            ? 'flex items-center gap-1.5 text-sm text-amber-700'
            : 'flex items-center gap-1.5 text-sm text-emerald-700'
        }
      >
        {refundsFailed > 0 ? (
          <TriangleAlert className="size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0" />
        )}
        {t('cancelled', { orders: cancelledOrders, failed: refundsFailed })}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <ConfirmButton
        danger
        label={t('cancel')}
        confirmLabel={t('confirmCancel')}
        backLabel={t('back')}
        hint={t('cancelHint')}
        onConfirm={async () => setState(await cancelEvent(eventId))}
      />
      {state && !state.ok && <ActionError code={state.errorCode} />}
    </div>
  );
}
