'use client';

import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from './button';

type ConfirmButtonProps = {
  label: string;
  confirmLabel: string;
  backLabel: string;
  hint?: string; // shown while asking, e.g. what the action will do
  danger?: boolean;
  onConfirm: () => Promise<void>;
};

/**
 * A button for an action that cannot be undone. The first click asks, the second one acts.
 * Used instead of the browser's confirm(), which blocks the page and cannot be styled.
 */
export function ConfirmButton({ label, confirmLabel, backLabel, hint, danger, onConfirm }: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant={danger ? 'outline' : 'primary'}
        className={danger ? 'text-red-600' : undefined}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={danger ? 'danger' : 'primary'}
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              await onConfirm();
              setConfirming(false);
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          {backLabel}
        </Button>
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
