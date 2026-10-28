'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { retryRefund, type RetryRefundState } from '../actions';
import { ActionError } from './action-error';

// Not two-step: retrying cannot refund twice (the api never re-sends a refund that succeeded).
export function RetryRefundButton({ refundId }: { refundId: number }) {
  const t = useTranslations('admin');
  const [state, setState] = useState<RetryRefundState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(async () => setState(await retryRefund(refundId)))}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="size-4" aria-hidden />
        )}
        {t('retryRefund')}
      </Button>
      {state && !state.ok && <ActionError code={state.errorCode} />}
    </div>
  );
}
